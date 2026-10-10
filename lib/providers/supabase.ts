import type { Provider, TokenSet } from "./types";

// Supabase OAuth for the Management API (https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration).
// PKCE is recommended; client credentials go in an HTTP Basic header on the token call.

const API = "https://api.supabase.com";

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  message?: string;
}

function basic(): string {
  return "Basic " + Buffer.from(`${process.env.SUPABASE_OAUTH_CLIENT_ID}:${process.env.SUPABASE_OAUTH_CLIENT_SECRET}`).toString("base64");
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API}/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Authorization: basic() },
    body: new URLSearchParams(body),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`Supabase: ${data.error_description ?? data.error ?? data.message ?? res.statusText}`);
  }
  return data;
}

// The docs don't state the access-token lifetime; fall back to 1 hour so we refresh early rather than late.
const expiry = (secs?: number) => new Date(Date.now() + (secs ?? 3600) * 1000);

export const supabase: Provider = {
  id: "supabase",
  name: "Supabase",
  blurb: "Creates a database for projects that need one and runs your SQL.",
  envVars: ["SUPABASE_OAUTH_CLIENT_ID", "SUPABASE_OAUTH_CLIENT_SECRET"],
  usesPkce: true,
  configured: () => Boolean(process.env.SUPABASE_OAUTH_CLIENT_ID && process.env.SUPABASE_OAUTH_CLIENT_SECRET),

  authorizeUrl({ state, redirectUri, challenge }) {
    const url = new URL(`${API}/v1/oauth/authorize`);
    url.searchParams.set("client_id", process.env.SUPABASE_OAUTH_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    if (challenge) {
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  },

  async exchange({ code, redirectUri, verifier }): Promise<TokenSet> {
    const t = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      ...(verifier ? { code_verifier: verifier } : {}),
    });

    // Projects are created inside an organization, so remember which one the user granted.
    let orgSlug: string | null = null;
    let label = "Supabase account";
    try {
      const res = await fetch(`${API}/v1/organizations`, { headers: { Authorization: `Bearer ${t.access_token}` } });
      if (res.ok) {
        const orgs = (await res.json()) as { id: string; slug?: string; name: string }[];
        if (orgs[0]) {
          orgSlug = orgs[0].slug ?? orgs[0].id;
          label = orgs.length > 1 ? `${orgs[0].name} +${orgs.length - 1}` : orgs[0].name;
        }
      }
    } catch {
      // Falls back to listing organizations when a project is created.
    }

    return {
      accessToken: t.access_token!,
      refreshToken: t.refresh_token,
      expiresAt: expiry(t.expires_in),
      accountLabel: label,
      meta: { orgSlug },
    };
  },

  async refresh(refreshToken) {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
    return { accessToken: t.access_token!, refreshToken: t.refresh_token ?? refreshToken, expiresAt: expiry(t.expires_in) };
  },
};
