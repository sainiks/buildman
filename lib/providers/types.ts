export type ProviderId = "github" | "vercel" | "supabase";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  /** What the user sees on the connection card, e.g. "@kunal" or "My Team". */
  accountLabel: string;
  accountId?: string;
  /** Provider-specific extras (Vercel teamId, Supabase org slug, ...). */
  meta?: Record<string, unknown>;
}

export interface Provider {
  id: ProviderId;
  name: string;
  /** One line shown on the connection card. */
  blurb: string;
  /** Names of env vars that must be set for this provider to work. */
  envVars: string[];
  usesPkce: boolean;
  configured(): boolean;
  authorizeUrl(args: { state: string; redirectUri: string; challenge?: string }): string;
  exchange(args: {
    code: string;
    redirectUri: string;
    verifier?: string;
    params: URLSearchParams;
  }): Promise<TokenSet>;
  refresh?(refreshToken: string): Promise<Pick<TokenSet, "accessToken" | "refreshToken" | "expiresAt">>;
}
