import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { createRepo } from "@/lib/github";
import { ownProject, updateProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";
import { slugify } from "@/lib/slug";

export const maxDuration = 60;

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const b = (await req.json()) as { projectId?: string; name?: string; isPrivate?: boolean; snippetInstalled?: boolean };
  const project = await ownProject(userId, b.projectId);
  const slug = slugify(String(b.name ?? ""));
  if (!slug) throw new HttpError(400, "Project name is empty.");

  const { token } = await credentials(userId, "github");
  const repo = await createRepo(token, slug, b.isPrivate !== false);
  await updateProject(userId, project.id, {
    repo_full_name: repo.fullName,
    repo_url: repo.htmlUrl,
    repo_id: repo.id,
    branch: repo.branch,
    snippet_installed: b.snippetInstalled === true,
  });
  return repo;
});
