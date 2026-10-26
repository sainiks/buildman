import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { ownProject, updateProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { createSupabaseProject } from "@/lib/supabase";

export const maxDuration = 60;

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const b = (await req.json()) as { projectId?: string; name?: string; region?: string };
  const project = await ownProject(userId, b.projectId);
  if (project.supabase_ref) return { ref: project.supabase_ref, dbPass: null, reused: true };
  const slug = slugify(String(b.name ?? ""));
  if (!slug) throw new HttpError(400, "Project name is empty.");

  const { token, meta } = await credentials(userId, "supabase");
  const created = await createSupabaseProject(token, slug, b.region || process.env.SUPABASE_REGION || "ap-south-1", meta.orgSlug);
  await updateProject(userId, project.id, { supabase_ref: created.ref });
  return created;
});
