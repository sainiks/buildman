import { decrypt, encrypt } from "./crypto";
import { db, ok } from "./db";
import { HttpError } from "./env";
import { getProvider, type ProviderId } from "./providers";
import type { TokenSet } from "./providers/types";

interface ConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  account_label: string;
  account_id: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
  meta: Record<string, unknown>;
  updated_at: string;
}

export interface ConnectionSummary {
  provider: ProviderId;
  accountLabel: string;
  connectedAt: string;
}

export async function saveConnection(userId: string, provider: ProviderId, t: TokenSet): Promise<void> {
  ok(
    await db()
      .from("connections")
      .upsert(
        {
          user_id: userId,
          provider,
          account_label: t.accountLabel,
          account_id: t.accountId ?? null,
          access_token_enc: encrypt(t.accessToken),
          refresh_token_enc: t.refreshToken ? encrypt(t.refreshToken) : null,
          expires_at: t.expiresAt?.toISOString() ?? null,
          meta: t.meta ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      ),
    "Save connection",
  );
}

export async function listConnections(userId: string): Promise<ConnectionSummary[]> {
  const rows = ok(
    await db().from("connections").select("provider, account_label, updated_at").eq("user_id", userId),
    "List connections",
  ) as { provider: ProviderId; account_label: string; updated_at: string }[];
  return rows.map((r) => ({ provider: r.provider, accountLabel: r.account_label, connectedAt: r.updated_at }));
}

export async function deleteConnection(userId: string, provider: ProviderId): Promise<void> {
  ok(await db().from("connections").delete().eq("user_id", userId).eq("provider", provider), "Disconnect");
}

export interface Credentials {
  token: string;
  meta: Record<string, unknown>;
}

/** Decrypted access token for a user's provider, refreshed first if it is about to expire. */
export async function credentials(userId: string, provider: ProviderId): Promise<Credentials> {
  const row = ok(
    await db().from("connections").select("*").eq("user_id", userId).eq("provider", provider).maybeSingle(),
    "Load connection",
  ) as ConnectionRow | null;
  const p = getProvider(provider);
  if (!row || !p) throw new HttpError(409, `${p?.name ?? provider} isn't connected. Connect it from the Connections page.`);

  let token = decrypt(row.access_token_enc);
  const expiresSoon = row.expires_at && new Date(row.expires_at).getTime() - Date.now() < 60_000;
  if (expiresSoon) {
    if (!row.refresh_token_enc || !p.refresh) {
      throw new HttpError(409, `Your ${p.name} connection expired. Reconnect it from the Connections page.`);
    }
    try {
      const fresh = await p.refresh(decrypt(row.refresh_token_enc));
      token = fresh.accessToken;
      ok(
        await db()
          .from("connections")
          .update({
            access_token_enc: encrypt(fresh.accessToken),
            refresh_token_enc: fresh.refreshToken ? encrypt(fresh.refreshToken) : row.refresh_token_enc,
            expires_at: fresh.expiresAt?.toISOString() ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id),
        "Store refreshed token",
      );
    } catch {
      throw new HttpError(409, `Your ${p.name} connection expired. Reconnect it from the Connections page.`);
    }
  }
  return { token, meta: row.meta ?? {} };
}
