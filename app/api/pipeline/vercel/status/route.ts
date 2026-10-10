import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { ownProject, updateProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";
import { deploymentStatus, vercelAuth } from "@/lib/vercel";

export const maxDuration = 30;

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const q = new URL(req.url).searchParams;
  const id = q.get("id");
  if (!id || !/^[A-Za-z0-9_-]{6,60}$/.test(id)) throw new HttpError(400, "id is required.");
  const project = await ownProject(userId, q.get("projectId"));

  const vc = vercelAuth(await credentials(userId, "vercel"));
  const s = await deploymentStatus(vc, id);
  if (s.state === "READY") {
    await updateProject(userId, project.id, {
      status: "live",
      live_url: s.liveUrl ?? project.live_url,
      last_deployed_at: new Date().toISOString(),
    });
  } else if (s.state === "ERROR" || s.state === "CANCELED") {
    await updateProject(userId, project.id, { status: "failed" });
  }
  return s;
});
