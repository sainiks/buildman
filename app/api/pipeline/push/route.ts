import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { pushBatch, type BatchFile } from "@/lib/github";
import { ownProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";

export const maxDuration = 60;

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const b = (await req.json()) as { projectId?: string; baseTree?: string | null; files?: BatchFile[] };
  const project = await ownProject(userId, b.projectId);
  if (!project.repo_full_name) throw new HttpError(409, "Create the repository first.");
  if (!Array.isArray(b.files) || b.files.length === 0) throw new HttpError(400, "files must be a non-empty array.");

  const [owner, repo] = project.repo_full_name.split("/");
  const { token } = await credentials(userId, "github");
  return { treeSha: await pushBatch(token, owner, repo, b.baseTree ?? null, b.files) };
});
