import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { triggerBuild } from "@/lib/netlify";
import { ownProject, updateProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";

export const maxDuration = 60;

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { projectId } = (await req.json()) as { projectId?: string };
  const project = await ownProject(userId, projectId);
  if (!project.netlify_site_id) throw new HttpError(409, "Create the Netlify site first.");
  const nl = await credentials(userId, "netlify");
  const { deployId } = await triggerBuild(nl.token, project.netlify_site_id);
  await updateProject(userId, project.id, { status: "building" });
  return { id: deployId };
});
