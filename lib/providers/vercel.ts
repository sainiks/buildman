import type { Provider, TokenSet } from "./types";

// Vercel gives third-party apps API access through an Integration: the user installs it from
// vercel.com, Vercel redirects back here with a one-time `code`, and we swap it for a long-lived
// access token (https://vercel.com/docs/integrations/create-integration/vercel-api-integrations).

interface TokenResponse {
  access_token?: string;
  installation_id?: string;
  user_id?: string;
  team_id?: string | null;
  error?: string;
  error_description?: string;
}

// Vercel reserves every variable name starting with "VERCEL_" for itself, so on Vercel hosting these
// settings are named VC_*. The old VERCEL_* names still work for local setups.
const slug = () => process.env.VC_INTEGRATION_SLUG || process.env.VERCEL_INTEGRATION_SLUG;
const clientId = () => process.env.VC_CLIENT_ID || process.env.VERCEL_CLIENT_ID;
const clientSecret = () => process.env.VC_CLIENT_SECRET || process.env.VERCEL_CLIENT_SECRET;

export const vercel: Provider = {
  id: "vercel",
  name: "Vercel",
  blurb: "Creates a Vercel project for each repo and deploys it to production.",
  envVars: ["VC_INTEGRATION_SLUG", "VC_CLIENT_ID", "VC_CLIENT_SECRET"],
  usesPkce: false,
  configured: () =>
    Boolean(slug() && clientId() && clientSecret()),

  authorizeUrl({ state }) {
    const url = new URL(`https://vercel.com/integrations/${slug()}/new`);
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchange({ code, redirectUri, params }): Promise<TokenSet> {
    const res = await fetch("https://api.vercel.com/v2/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId() ?? "",
        client_secret: clientSecret() ?? "",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok || !data.access_token) {
      throw new Error(`Vercel: ${data.error_description ?? data.error ?? res.statusText}`);
    }

    const teamId = data.team_id ?? params.get("teamId") ?? null;
    const headers = { Authorization: `Bearer ${data.access_token}` };
    let label = "Personal account";
    try {
      if (teamId) {
        const t = await fetch(`https://api.vercel.com/v2/teams/${teamId}`, { headers });
        if (t.ok) label = ((await t.json()) as { name?: string }).name ?? "Team";
      } else {
        const u = await fetch("https://api.vercel.com/v2/user", { headers });
        if (u.ok) {
          const user = ((await u.json()) as { user?: { username?: string } }).user;
          if (user?.username) label = user.username;
        }
      }
    } catch {
      // The label is cosmetic; keep the default.
    }

    return {
      accessToken: data.access_token,
      accountLabel: label,
      accountId: data.team_id ?? data.user_id,
      meta: { teamId, installationId: data.installation_id ?? null, configurationId: params.get("configurationId") },
    };
  },
};
