import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { deployStatus } from "@/lib/netlify";
import { ownProject, updateProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";

export const maxDuration = 30;

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const q = new URL(req.url).searchParams;
  const id = q.get("id");
  if (!id || !/^[A-Za-z0-9_-]{6,60}$/.test(id)) throw new HttpError(400, "id is required.");
  const project = await ownProject(userId, q.get("projectId"));

  const nl = await credentials(userId, "netlify");
  const s = await deployStatus(nl.token, id);
  if (s.state === "READY") {
    await updateProject(userId, project.id, {
      status: "live",
      live_url: s.liveUrl ?? project.live_url,
      last_deployed_at: new Date().toISOString(),
    });
  } else if (s.state === "ERROR") {
    await updateProject(userId, project.id, { status: "failed" });
  }
  return s;
});
