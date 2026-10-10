import { parseDotenv } from "./dotenv";

export interface DetectInput {
  /** Every path that will be pushed (repo-relative, forward slashes). */
  paths: string[];
  /** Contents of the small files detection cares about, keyed by path. */
  text: Record<string, string>;
}

export interface Plan {
  /** Vercel framework preset slug, or null to let Vercel auto-detect. */
  framework: string | null;
  frameworkLabel: string;
  needsDb: boolean;
  dbReasons: string[];
  /** SQL files to run on the new database, in order. */
  migrations: string[];
  /** Env var names the project declares in its example env files. */
  declaredEnv: string[];
  warnings: string[];
}

export const EXAMPLE_ENV_FILES = [
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.local.example",
  ".env.development.example",
];

/** Small files the client reads so detection (and the server) can see inside them. */
export const TEXT_KEYS = ["package.json", "supabase/config.toml", ...EXAMPLE_ENV_FILES];

const SCHEMA_FALLBACKS = [
  "supabase/schema.sql",
  "schema.sql",
  "db/schema.sql",
  "database/schema.sql",
  "sql/schema.sql",
];

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackage(src?: string): PackageJson | null {
  if (!src) return null;
  try {
    return JSON.parse(src) as PackageJson;
  } catch {
    return null;
  }
}

export function detect({ paths, text }: DetectInput): Plan {
  const warnings: string[] = [];
  const pkg = readPackage(text["package.json"]);
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const has = (name: string) => name in deps;
  const hasPrefix = (prefix: string) => Object.keys(deps).some((d) => d.startsWith(prefix));

  let framework: string | null = null;
  let frameworkLabel = "Auto-detect";
  if (has("next")) [framework, frameworkLabel] = ["nextjs", "Next.js"];
  else if (has("@sveltejs/kit")) [framework, frameworkLabel] = ["sveltekit", "SvelteKit"];
  else if (has("astro")) [framework, frameworkLabel] = ["astro", "Astro"];
  else if (has("nuxt")) [framework, frameworkLabel] = ["nuxtjs", "Nuxt"];
  else if (hasPrefix("@remix-run/")) [framework, frameworkLabel] = ["remix", "Remix"];
  else if (has("gatsby")) [framework, frameworkLabel] = ["gatsby", "Gatsby"];
  else if (has("vite")) [framework, frameworkLabel] = ["vite", "Vite"];
  else if (has("react-scripts")) [framework, frameworkLabel] = ["create-react-app", "Create React App"];
  else if (pkg) frameworkLabel = "Node project (auto-detect)";
  else if (paths.includes("index.html")) frameworkLabel = "Static site";
  else {
    const nested = paths.find((p) => /^[^/]+\/package\.json$/.test(p));
    warnings.push(
      nested
        ? `package.json is inside "${nested.split("/")[0]}/", not at the top. The project may be nested one level too deep in your zip.`
        : "No package.json or index.html at the top level. Vercel will try to auto-detect, but check your zip structure.",
    );
  }

  const declaredEnv = new Set<string>();
  for (const file of EXAMPLE_ENV_FILES) {
    if (text[file]) Object.keys(parseDotenv(text[file])).forEach((k) => declaredEnv.add(k));
  }

  const dbReasons: string[] = [];
  if (has("@supabase/supabase-js") || has("@supabase/ssr") || hasPrefix("@supabase/auth-helpers")) {
    dbReasons.push("uses the Supabase client library");
  }
  if (paths.some((p) => p.startsWith("supabase/"))) dbReasons.push("has a supabase/ folder");
  if ([...declaredEnv].some((k) => /SUPABASE/.test(k))) dbReasons.push("declares SUPABASE_* env vars");

  let migrations = paths.filter((p) => /^supabase\/migrations\/.+\.sql$/.test(p)).sort();
  if (migrations.length === 0) {
    const fallback = SCHEMA_FALLBACKS.find((p) => paths.includes(p));
    if (fallback) migrations = [fallback];
  }
  if (migrations.length > 0 && dbReasons.length === 0) dbReasons.push("includes SQL schema files");

  return {
    framework,
    frameworkLabel,
    needsDb: dbReasons.length > 0,
    dbReasons,
    migrations,
    declaredEnv: [...declaredEnv],
    warnings,
  };
}
