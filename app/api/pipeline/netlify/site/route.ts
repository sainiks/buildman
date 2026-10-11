import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { addDeployKey, addWebhook } from "@/lib/github";
import { accountSlugFor, createDeployKey, createSite, setEnv } from "@/lib/netlify";
import { ownProject, updateProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { getSupabaseValues } from "@/lib/supabase";
import { resolveSupabaseEnv } from "@/lib/supabaseEnv";

export const maxDuration = 60;

// Creates the Netlify site for a project: deploy key on the GitHub repo, the site linked to it,
// a push webhook, and the project's env vars (local .env values plus the new Supabase keys).
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const b = (await req.json()) as {
    projectId?: string;
    name?: string;
    framework?: string | null;
    envVars?: Record<string, string>;
    declaredEnv?: string[];
    dbPass?: string | null;
    isPrivate?: boolean;
  };
  const project = await ownProject(userId, b.projectId);
  const name = slugify(String(b.name ?? ""));
  if (!name || !project.repo_full_name || !project.repo_id || !project.branch) throw new HttpError(400, "Create the repository first.");

  const env: Record<string, string> = { ...(b.envVars ?? {}) };
  if (project.supabase_ref && b.dbPass) {
    const sb = await credentials(userId, "supabase");
    const values = await getSupabaseValues(sb.token, project.supabase_ref, b.dbPass);
    Object.assign(env, resolveSupabaseEnv(b.framework ?? null, b.declaredEnv ?? [], values));
  }

  const nl = await credentials(userId, "netlify");
  const gh = await credentials(userId, "github");

  const key = await createDeployKey(nl.token);
  try {
    await addDeployKey(gh.token, project.repo_full_name, "Netlify (added by Buildman)", key.publicKey);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    throw new HttpError(e instanceof HttpError ? e.status : 500, `Couldn't give Netlify read access to ${project.repo_full_name}: ${m}`);
  }

  const site = await createSite(nl.token, {
    name,
    fullName: project.repo_full_name,
    repoId: project.repo_id,
    branch: project.branch,
    isPrivate: b.isPrivate !== false,
    deployKeyId: key.id,
  });

  let hookNote: string | null = null;
  try {
    await addWebhook(gh.token, project.repo_full_name, "https://api.netlify.com/hooks/github", ["push", "pull_request", "delete"]);
  } catch (e) {
    hookNote = `Couldn't add the push webhook, so later pushes won't redeploy on their own: ${e instanceof Error ? e.message : String(e)}`;
  }

  let envCount = 0;
  if (Object.keys(env).length > 0) {
    const slug = await accountSlugFor(nl.token, site.accountSlug);
    envCount = await setEnv(nl.token, slug, site.id, env);
  }

  await updateProject(userId, project.id, { host: "netlify", netlify_site_id: site.id, netlify_site_name: site.name });
  return { id: site.id, name: site.name, envCount, hookNote };
});
