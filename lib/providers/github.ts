import type { Provider, TokenSet } from "./types";

const AUTHORIZE = "https://github.com/login/oauth/authorize";
const TOKEN = "https://github.com/login/oauth/access_token";

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID ?? "",
      client_secret: process.env.GITHUB_CLIENT_SECRET ?? "",
      ...params,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(`GitHub: ${data.error_description ?? data.error ?? res.statusText}`);
  }
  return data;
}

const expiry = (secs?: number) => (secs ? new Date(Date.now() + secs * 1000) : undefined);

export interface GitHubProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export async function fetchGitHubProfile(token: string): Promise<GitHubProfile> {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
  const res = await fetch("https://api.github.com/user", { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub: could not read your profile (${res.status}).`);
  const profile = (await res.json()) as GitHubProfile;
  if (!profile.email) {
    const emails = await fetch("https://api.github.com/user/emails", { headers, cache: "no-store" });
    if (emails.ok) {
      const list = (await emails.json()) as { email: string; primary: boolean; verified: boolean }[];
      profile.email = list.find((e) => e.primary && e.verified)?.email ?? null;
    }
  }
  return profile;
}

export const github: Provider = {
  id: "github",
  name: "GitHub",
  blurb: "Creates a repository for each project and pushes your code to it.",
  envVars: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  usesPkce: false,
  configured: () => Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),

  authorizeUrl({ state, redirectUri }) {
    const url = new URL(AUTHORIZE);
    url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    // "repo" is the narrowest scope that can create private repositories.
    url.searchParams.set("scope", "repo read:user user:email");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchange({ code, redirectUri }): Promise<TokenSet> {
    const t = await tokenRequest({ code, redirect_uri: redirectUri });
    const profile = await fetchGitHubProfile(t.access_token!);
    return {
      accessToken: t.access_token!,
      refreshToken: t.refresh_token,
      expiresAt: expiry(t.expires_in),
      accountLabel: `@${profile.login}`,
      accountId: String(profile.id),
      meta: { login: profile.login },
    };
  },

  // Only used when the OAuth app has "expiring user tokens" turned on.
  async refresh(refreshToken) {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
    return { accessToken: t.access_token!, refreshToken: t.refresh_token, expiresAt: expiry(t.expires_in) };
  },
};
