import { credentials } from "@/lib/connections";
import { db, ok } from "@/lib/db";
import { HttpError, handle } from "@/lib/env";
import { appUrl } from "@/lib/config";
import { readRepoFile, writeRepoFile } from "@/lib/github";
import { ownProject, updateProject } from "@/lib/projects";
import { requireUserId } from "@/lib/session";
import { SNIPPET_TARGETS, refreshTag } from "@/lib/snippet";

export const maxDuration = 60;

// Rewrites the tracking tag inside the project's GitHub repo so it points at this deployment
// (fixes tags saved while running on localhost). The commit triggers the host's auto-redeploy.
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const id = new URL(req.url).pathname.split("/").slice(-2)[0];
  const project = await ownProject(userId, id);
  if (!project.repo_full_name || !project.branch) throw new HttpError(409, "This project has no GitHub repo yet.");

  const { token } = await credentials(userId, "github");
  const scriptUrl = `${appUrl(req)}/t.js`;
  if (/localhost|127\.0\.0\.1/.test(scriptUrl)) throw new HttpError(409, "APP_URL on the server still points at localhost.");

  let touched: string | null = null;
  let seen = false;
  for (const t of SNIPPET_TARGETS) {
    const candidates = t.paths;
    for (const path of candidates) {
      const file = await readRepoFile(token, project.repo_full_name, path, project.branch);
      if (!file) continue;
      seen = true;
      const next = refreshTag(file.text, t, scriptUrl, project.public_key);
      if (next === null) {
        if (file.text.includes(scriptUrl) && file.text.includes(project.public_key)) touched = touched ?? `${path} (already correct)`;
        continue;
      }
      await writeRepoFile(token, project.repo_full_name, path, project.branch, next, file.sha, "Update Buildman tracking tag");
      await updateProject(userId, project.id, { snippet_installed: true });
      return { ok: true, path, message: `Updated ${path}. Your host will redeploy in a minute.` };
    }
  }
  if (touched) return { ok: true, path: touched, message: "The tag in your repo is already correct. If no visits show up, check the checklist below." };
  throw new HttpError(404, seen ? "Found your layout but no place to put the tag. Paste the line manually." : "Couldn't find app/layout, _document or index.html in the repo. Paste the line manually.");
});
