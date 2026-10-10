import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { ownProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";
import { runSql } from "@/lib/supabase";

export const maxDuration = 60;

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const b = (await req.json()) as { projectId?: string; name?: string; sql?: string };
  const project = await ownProject(userId, b.projectId);
  // Only ever run SQL against the database that belongs to this project.
  if (!project.supabase_ref) throw new HttpError(409, "This project has no database.");
  if (typeof b.sql !== "string") throw new HttpError(400, "sql is required.");
  if (!b.sql.trim()) return { ok: true, skipped: true };

  const { token } = await credentials(userId, "supabase");
  try {
    await runSql(token, project.supabase_ref, b.sql);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new HttpError(e instanceof HttpError ? e.status : 500, `${b.name ?? "migration"} failed: ${message}`);
  }
  return { ok: true };
});
