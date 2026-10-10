import type { SupabaseValues } from "./supabase";

const FRAMEWORK_DEFAULTS: Record<string, string[]> = {
  nextjs: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  vite: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
  "create-react-app": ["REACT_APP_SUPABASE_URL", "REACT_APP_SUPABASE_ANON_KEY"],
  sveltekit: ["PUBLIC_SUPABASE_URL", "PUBLIC_SUPABASE_ANON_KEY"],
  astro: ["PUBLIC_SUPABASE_URL", "PUBLIC_SUPABASE_ANON_KEY"],
  nuxtjs: ["SUPABASE_URL", "SUPABASE_KEY"],
};
const FALLBACK = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];

function valueFor(name: string, v: SupabaseValues): string | undefined {
  if (/SERVICE(_ROLE)?_KEY$/.test(name)) return v.service;
  if (/(^|_)SUPABASE_(ANON_)?KEY$/.test(name) || /ANON_KEY$/.test(name)) return v.anon;
  if (/SUPABASE_URL$/.test(name)) return v.url;
  if (name === "DATABASE_URL" || name === "POSTGRES_URL") return v.databaseUrl;
  return undefined;
}

/**
 * Picks which env vars to set from the new Supabase project: every Supabase-looking name the
 * project declares in its .env example, plus the framework's usual public pair. The service-role
 * key and DATABASE_URL are only set when the project explicitly declares them.
 */
export function resolveSupabaseEnv(
  framework: string | null,
  declared: string[],
  values: SupabaseValues,
): Record<string, string> {
  const names = new Set<string>(FRAMEWORK_DEFAULTS[framework ?? ""] ?? FALLBACK);
  for (const n of declared) {
    if (/SUPABASE/.test(n) || n === "DATABASE_URL" || n === "POSTGRES_URL") names.add(n);
  }
  const env: Record<string, string> = {};
  for (const name of names) {
    const value = valueFor(name, values);
    if (value) env[name] = value;
  }
  return env;
}
