import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "@/lib/config";
import { currentUserId } from "@/lib/session";
import { OAUTH_COOKIE, cookieString, signToken } from "@/lib/sessionToken";
import { getProvider } from "@/lib/providers";
import { safeReturn, withParams } from "@/lib/returnTo";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params;
  const provider = getProvider(id);
  const base = appUrl(req);
  // Optional: where to land afterwards (the connect pop-up uses /connect-done). Allow-listed paths only.
  const ret = safeReturn(new URL(req.url).searchParams.get("return"));
  const fail = (msg: string, to = "/connections") =>
    Response.redirect(ret ? `${base}${withParams(ret, { error: msg })}` : `${base}${to}?error=${encodeURIComponent(msg)}`, 302);

  if (!provider) return fail("Unknown connection.");
  const userId = await currentUserId();
  // Only GitHub can be started signed out: it is how people sign in.
  if (!userId && provider.id !== "github") return Response.redirect(`${base}/login`, 302);
  if (!provider.configured()) {
    return fail(`${provider.name} isn't set up on this server yet (missing ${provider.envVars.join(", ")}).`, userId ? "/connections" : "/login");
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = provider.usesPkce ? randomBytes(32).toString("base64url") : undefined;
  const challenge = verifier ? createHash("sha256").update(verifier).digest("base64url") : undefined;

  const redirectUri = `${base}/api/oauth/${provider.id}/callback`;
  // The signed cookie proves this browser started the flow and carries the PKCE verifier.
  const pending = await signToken({ state, verifier, provider: provider.id, uid: userId, ret }, 600);

  const res = new Response(null, { status: 302, headers: { Location: provider.authorizeUrl({ state, redirectUri, challenge }) } });
  res.headers.append("Set-Cookie", cookieString(OAUTH_COOKIE, pending, 600));
  return res;
}
