import { db, ok } from "@/lib/db";
import { handle } from "@/lib/env";
import { ownProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";

// Removes the project from Buildman (and its analytics). It does not touch the GitHub repo,
// the Vercel project or the Supabase database.
export const DELETE = handle(async (req) => {
  const userId = await requireUserId();
  const id = new URL(req.url).pathname.split("/").pop();
  const project = await ownProject(userId, id);
  ok(await db().from("projects").delete().eq("id", project.id).eq("user_id", userId), "Remove project");
  return { ok: true };
});
