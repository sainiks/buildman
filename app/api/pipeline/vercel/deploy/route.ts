import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { ownProject, updateProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";
import { createDeployment, vercelAuth } from "@/lib/vercel";

export const maxDuration = 60;

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { projectId } = (await req.json()) as { projectId?: string };
  const project = await ownProject(userId, projectId);
  if (!project.vercel_project_name || !project.repo_id || !project.branch) {
    throw new HttpError(409, "Create the Vercel project first.");
  }
  const vc = vercelAuth(await credentials(userId, "vercel"));
  const d = await createDeployment(vc, { project: project.vercel_project_name, repoId: project.repo_id, branch: project.branch });
  await updateProject(userId, project.id, { status: "building" });
  return d;
});
