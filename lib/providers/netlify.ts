import type { Provider, TokenSet } from "./types";

// Netlify OAuth for third-party apps. Register at Netlify -> User settings -> Applications -> OAuth
// applications. Netlify's docs for the code exchange are thin: the authorize URL and
// https://api.netlify.com/oauth/token (authorization-code grant) are what its own CLI and examples use.
// Netlify access tokens don't expire, so there is no refresh step.

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

const clientId = () => process.env.NETLIFY_CLIENT_ID;
const clientSecret = () => process.env.NETLIFY_CLIENT_SECRET;

export const netlify: Provider = {
  id: "netlify",
  name: "Netlify",
  blurb: "An alternative host: Buildman creates a Netlify site for each repo and deploys it.",
  envVars: ["NETLIFY_CLIENT_ID", "NETLIFY_CLIENT_SECRET"],
  usesPkce: false,
  configured: () => Boolean(clientId() && clientSecret()),

  authorizeUrl({ state, redirectUri }) {
    const url = new URL("https://app.netlify.com/authorize");
    url.searchParams.set("client_id", clientId() ?? "");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchange({ code, redirectUri }): Promise<TokenSet> {
    const res = await fetch("https://api.netlify.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId() ?? "",
        client_secret: clientSecret() ?? "",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok || !data.access_token) {
      throw new Error(`Netlify: ${data.error_description ?? data.error ?? res.statusText}`);
    }

    let label = "Netlify account";
    let accountId: string | undefined;
    try {
      const u = await fetch("https://api.netlify.com/api/v1/user", { headers: { Authorization: `Bearer ${data.access_token}` } });
      if (u.ok) {
        const user = (await u.json()) as { id?: string; email?: string; full_name?: string };
        label = user.email ?? user.full_name ?? label;
        accountId = user.id;
      }
    } catch {
      // The label is cosmetic; keep the default.
    }
    return { accessToken: data.access_token, accountLabel: label, accountId };
  },
};
