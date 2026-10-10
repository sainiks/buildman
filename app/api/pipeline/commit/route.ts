import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { commitTree } from "@/lib/github";
import { ownProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";

export const maxDuration = 60;

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const b = (await req.json()) as { projectId?: string; treeSha?: string; parentSha?: string; message?: string };
  const project = await ownProject(userId, b.projectId);
  if (!project.repo_full_name || !project.branch) throw new HttpError(409, "Create the repository first.");
  if (!b.treeSha || !b.parentSha) throw new HttpError(400, "treeSha and parentSha are required.");

  const [owner, repo] = project.repo_full_name.split("/");
  const { token } = await credentials(userId, "github");
  const sha = await commitTree(token, owner, repo, project.branch, b.treeSha, b.parentSha, b.message ?? "Initial commit via Buildman");
  return { sha };
});
