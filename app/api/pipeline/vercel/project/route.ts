import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { ownProject, updateProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { getSupabaseValues } from "@/lib/supabase";
import { resolveSupabaseEnv } from "@/lib/supabaseEnv";
import { createProject, vercelAuth } from "@/lib/vercel";

export const maxDuration = 60;

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const b = (await req.json()) as {
    projectId?: string;
    name?: string;
    framework?: string | null;
    envVars?: Record<string, string>;
    declaredEnv?: string[];
    dbPass?: string | null;
  };
  const project = await ownProject(userId, b.projectId);
  const name = slugify(String(b.name ?? ""));
  if (project.vercel_project_id) return { id: project.vercel_project_id, name: project.vercel_project_name ?? name, envCount: 0 };
  if (!name || !project.repo_full_name) throw new HttpError(400, "Create the repository first.");

  // Values from the user's local .env first; the freshly created database overrides matching names.
  const env: Record<string, string> = { ...(b.envVars ?? {}) };
  if (project.supabase_ref && b.dbPass) {
    const sb = await credentials(userId, "supabase");
    const values = await getSupabaseValues(sb.token, project.supabase_ref, b.dbPass);
    Object.assign(env, resolveSupabaseEnv(b.framework ?? null, b.declaredEnv ?? [], values));
  }

  const vc = vercelAuth(await credentials(userId, "vercel"));
  const created = await createProject(vc, { name, fullName: project.repo_full_name, framework: b.framework ?? null, env });
  await updateProject(userId, project.id, { vercel_project_id: created.id, vercel_project_name: created.name });
  return { ...created, envCount: Object.keys(env).length };
});
