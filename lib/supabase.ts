import { randomBytes } from "node:crypto";
import { HttpError, sleep } from "./env";

const API = "https://api.supabase.com";

async function sb<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const text = await res.text();
  let data: { message?: string } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    if (res.status === 401) throw new HttpError(409, "Your Supabase connection expired. Reconnect it from the Connections page.");
    throw new HttpError(res.status, `Supabase ${res.status}: ${data.message ?? text}`);
  }
  return data as T;
}

async function organization(token: string, known?: unknown): Promise<string> {
  if (typeof known === "string" && known) return known;
  const orgs = await sb<{ id: string; slug?: string; name: string }[]>(token, "/v1/organizations");
  if (orgs.length >= 1) return orgs[0].slug ?? orgs[0].id;
  throw new HttpError(400, "No Supabase organization found on this connection.");
}

export async function createSupabaseProject(token: string, name: string, region: string, orgSlug?: unknown) {
  const org = await organization(token, orgSlug);
  const dbPass = randomBytes(18).toString("base64url");
  const project = await sb<{ id: string; name: string }>(token, "/v1/projects", {
    method: "POST",
    body: JSON.stringify({ name, organization_id: org, organization_slug: org, db_pass: dbPass, region }),
  });
  return { ref: project.id, name: project.name, dbPass };
}

export async function supabaseStatus(token: string, ref: string): Promise<string> {
  const p = await sb<{ status: string }>(token, `/v1/projects/${ref}`);
  return p.status;
}

export async function runSql(token: string, ref: string, query: string) {
  let lastError: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      return await sb(token, `/v1/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query }) });
    } catch (e) {
      lastError = e;
      // 5xx / 429 right after provisioning is normal; anything else is a real SQL error.
      if (e instanceof HttpError && e.status < 500 && e.status !== 429) throw e;
      await sleep(3000);
    }
  }
  throw lastError;
}

export interface SupabaseValues {
  url: string;
  anon?: string;
  service?: string;
  databaseUrl?: string;
}

export async function getSupabaseValues(token: string, ref: string, dbPass: string): Promise<SupabaseValues> {
  const keys = await sb<{ name: string; api_key: string }[]>(token, `/v1/projects/${ref}/api-keys`);
  const values: SupabaseValues = {
    url: `https://${ref}.supabase.co`,
    anon: keys.find((k) => k.name === "anon")?.api_key,
    service: keys.find((k) => k.name === "service_role")?.api_key,
  };
  try {
    const pools = await sb<{ db_host: string; db_port: number; db_user: string; db_name: string; pool_mode?: string }[]>(
      token,
      `/v1/projects/${ref}/config/database/pooler`,
    );
    const p = pools.find((x) => x.pool_mode === "transaction") ?? pools[0];
    if (p) {
      values.databaseUrl = `postgresql://${p.db_user}:${encodeURIComponent(dbPass)}@${p.db_host}:${p.db_port}/${p.db_name}`;
    }
  } catch {
    // Pooler config is optional; DATABASE_URL is skipped if it can't be read.
  }
  return values;
}

export interface ApiUsage {
  rest: number;
  auth: number;
  storage: number;
  realtime: number;
  total: number;
}

/** Sum of the Management API's API-request counters for the project (default interval). */
export async function apiUsage(token: string, ref: string): Promise<ApiUsage> {
  const r = await sb<{
    result?: {
      total_rest_requests?: number;
      total_auth_requests?: number;
      total_storage_requests?: number;
      total_realtime_requests?: number;
    }[];
  }>(token, `/v1/projects/${ref}/analytics/endpoints/usage.api-counts`);
  const sum = (k: "total_rest_requests" | "total_auth_requests" | "total_storage_requests" | "total_realtime_requests") =>
    (r.result ?? []).reduce((n, row) => n + (Number(row[k]) || 0), 0);
  const usage = {
    rest: sum("total_rest_requests"),
    auth: sum("total_auth_requests"),
    storage: sum("total_storage_requests"),
    realtime: sum("total_realtime_requests"),
  };
  return { ...usage, total: usage.rest + usage.auth + usage.storage + usage.realtime };
}
