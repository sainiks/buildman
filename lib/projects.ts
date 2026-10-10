import { newPublicKey } from "./crypto";
import { db, ok, type ProjectRow } from "./db";
import { HttpError } from "./env";

export async function createProjectRecord(userId: string, name: string, framework: string | null): Promise<ProjectRow> {
  return ok(
    await db()
      .from("projects")
      .insert({ user_id: userId, name, framework, public_key: newPublicKey() })
      .select("*")
      .single(),
    "Create project",
  ) as ProjectRow;
}

/** Loads a project and checks it belongs to the user. 404 for both missing and foreign ids. */
export async function ownProject(userId: string, id: unknown): Promise<ProjectRow> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "projectId is required.");
  const row = ok(
    await db().from("projects").select("*").eq("id", id).eq("user_id", userId).maybeSingle(),
    "Load project",
  ) as ProjectRow | null;
  if (!row) throw new HttpError(404, "Project not found.");
  return row;
}

export async function updateProject(userId: string, id: string, patch: Partial<ProjectRow>): Promise<void> {
  ok(await db().from("projects").update(patch).eq("id", id).eq("user_id", userId), "Update project");
}
