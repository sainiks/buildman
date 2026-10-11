import { credentials } from "./connections";
import type { ProjectRow } from "./db";
import { repoActivity, type RepoActivity } from "./github";
import { apiUsage, type ApiUsage } from "./supabase";
import { listNetlifyDeploys } from "./netlify";
import { listDeployments, vercelAuth, type DeploymentSummary } from "./vercel";

export type Panel<T> = { status: "ok"; data: T } | { status: "error"; message: string } | { status: "na"; message: string };

async function guard<T>(fn: () => Promise<T>): Promise<Panel<T>> {
  try {
    return { status: "ok", data: await fn() };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Couldn't load this." };
  }
}

export interface PlatformStats {
  vercel: Panel<DeploymentSummary[]>;
  supabase: Panel<ApiUsage>;
  github: Panel<RepoActivity>;
}

/** What each connected service says about a project. Every panel fails on its own. */
export async function platformStats(userId: string, p: ProjectRow): Promise<PlatformStats> {
  const [vercel, supabase, github] = await Promise.all([
    p.netlify_site_id
      ? guard(async () => listNetlifyDeploys((await credentials(userId, "netlify")).token, p.netlify_site_id!, 5))
      : p.vercel_project_id
      ? guard(async () => listDeployments(vercelAuth(await credentials(userId, "vercel")), p.vercel_project_id!, 5))
      : Promise.resolve<Panel<DeploymentSummary[]>>({ status: "na", message: "This project isn't deployed on a host yet." }),
    p.supabase_ref
      ? guard(async () => apiUsage((await credentials(userId, "supabase")).token, p.supabase_ref!))
      : Promise.resolve<Panel<ApiUsage>>({ status: "na", message: "This project has no Supabase database." }),
    p.repo_full_name
      ? guard(async () => repoActivity((await credentials(userId, "github")).token, p.repo_full_name!))
      : Promise.resolve<Panel<RepoActivity>>({ status: "na", message: "No repository yet." }),
  ]);
  return { vercel, supabase, github };
}
