import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { need } from "./env";

let client: SupabaseClient | null = null;

/** Server-only client for Buildman's own database (service role, bypasses RLS). */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(need("GITMAN_SUPABASE_URL"), need("GITMAN_SUPABASE_SERVICE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export interface UserRow {
  id: string;
  github_id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  public_key: string;
  framework: string | null;
  status: "creating" | "building" | "live" | "failed";
  repo_full_name: string | null;
  repo_url: string | null;
  repo_id: number | null;
  branch: string | null;
  vercel_project_id: string | null;
  vercel_project_name: string | null;
  /** Where it is deployed. Older rows (before Netlify support) are "vercel". */
  host?: "vercel" | "netlify" | null;
  netlify_site_id?: string | null;
  netlify_site_name?: string | null;
  live_url: string | null;
  supabase_ref: string | null;
  snippet_installed: boolean;
  created_at: string;
  last_deployed_at: string | null;
}

/** Throws a readable error for a failed Supabase call. */
export function ok<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}
