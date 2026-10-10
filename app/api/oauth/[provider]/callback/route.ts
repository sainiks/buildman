import { appUrl } from "@/lib/config";
import { saveConnection } from "@/lib/connections";
import { db, ok } from "@/lib/db";
import { fetchGitHubProfile } from "@/lib/providers/github";
import { getProvider } from "@/lib/providers";
import { safeReturn, withParams } from "@/lib/returnTo";
import { createSessionCookie, currentUserId } from "@/lib/session";
import { OAUTH_COOKIE, clearCookie, verifyToken } from "@/lib/sessionToken";

interface Pending extends Record<string, unknown> {
  state: string;
  verifier?: string;
  provider: string;
  uid?: string | null;
  /** Allow-listed path to land on afterwards (set by /start from `?return=`). */
  ret?: string | null;
}

function cookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return undefined;
}

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params;
  const base = appUrl(req);
  const url = new URL(req.url);
  const provider = getProvider(id);

  const done = (to: string, cookie?: string) => {
    const res = new Response(null, { status: 302, headers: { Location: `${base}${to}` } });
    res.headers.append("Set-Cookie", clearCookie(OAUTH_COOKIE));
    if (cookie) res.headers.append("Set-Cookie", cookie);
    return res;
  };

  const sessionUser = await currentUserId();
  const pending = await verifyToken<Pending>(cookieValue(req, OAUTH_COOKIE));
  // Only trust the return path from a cookie that our own /start signed for this provider; it is
  // re-validated against the allow-list here as well.
  const ret = pending && pending.provider === provider?.id && typeof pending.ret === "string" ? safeReturn(pending.ret) : null;

  const errorTo = (msg: string) =>
    ret
      ? withParams(ret, { error: msg })
      : `${sessionUser || provider?.id !== "github" ? "/connections" : "/login"}?error=${encodeURIComponent(msg)}`;

  if (!provider) return done("/connections?error=Unknown%20connection.");
  if (url.searchParams.get("error")) {
    return done(errorTo(`${provider.name} said no: ${url.searchParams.get("error_description") ?? url.searchParams.get("error")}`));
  }

  const code = url.searchParams.get("code");
  if (!code || !pending || pending.provider !== provider.id) {
    return done(errorTo("That sign-in link expired. Start again."));
  }
  // GitHub and Supabase always echo `state`. Vercel's integration flow may not, so for Vercel the
  // signed cookie (set only by our /start route in this browser) is the proof of origin.
  const returned = url.searchParams.get("state");
  if (returned ? returned !== pending.state : provider.id !== "vercel") {
    return done(errorTo("The sign-in response didn't match this browser. Start again."));
  }
  if (pending.uid && pending.uid !== sessionUser) return done(errorTo("Your session changed during sign-in. Start again."));

  try {
    const tokens = await provider.exchange({
      code,
      redirectUri: `${base}/api/oauth/${provider.id}/callback`,
      verifier: pending.verifier,
      params: url.searchParams,
    });

    // GitHub signed out: this is a login. Create or update the user, then start a session.
    if (provider.id === "github" && !sessionUser) {
      const profile = await fetchGitHubProfile(tokens.accessToken);
      const user = ok(
        await db()
          .from("users")
          .upsert(
            {
              github_id: profile.id,
              login: profile.login,
              name: profile.name,
              email: profile.email,
              avatar_url: profile.avatar_url,
              last_login_at: new Date().toISOString(),
            },
            { onConflict: "github_id" },
          )
          .select("id")
          .single(),
        "Save user",
      ) as { id: string };
      await saveConnection(user.id, "github", tokens);
      return done("/dashboard", await createSessionCookie(user.id));
    }

    if (!sessionUser) return done("/login");
    await saveConnection(sessionUser, provider.id, tokens);

    // Vercel hands back a `next` URL to finish its install flow.
    const next = url.searchParams.get("next");
    const nextOk = next && /^https:\/\/([a-z0-9-]+\.)*vercel\.com\//i.test(next) ? next : null;

    // Started from the ship flow's connect pop-up: go back to the small "connected" page.
    if (ret) return done(withParams(ret, { connected: provider.id, ...(nextOk ? { next: nextOk } : {}) }));

    const finish = nextOk ? `&next=${encodeURIComponent(nextOk)}` : "";
    return done(`/connections?connected=${provider.id}${finish}`);
  } catch (e) {
    return done(errorTo(e instanceof Error ? e.message : "Connection failed."));
  }
}
