import { appUrl } from "@/lib/config";
import { HttpError, handle } from "@/lib/env";
import { createProjectRecord } from "@/lib/projects";
import { requireUserId } from "@/lib/session";
import { slugify } from "@/lib/slug";

export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { name, framework } = (await req.json()) as { name?: string; framework?: string | null };
  const slug = slugify(String(name ?? ""));
  if (!slug) throw new HttpError(400, "Project name is empty.");
  const project = await createProjectRecord(userId, slug, framework ?? null);
  return { id: project.id, publicKey: project.public_key, scriptUrl: `${appUrl(req)}/t.js` };
});
