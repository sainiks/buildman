import { HttpError } from "./env";

const API = "https://api.vercel.com";

export interface VercelAuth {
  token: string;
  /** Set when the integration was installed on a team (appended as ?teamId=). */
  teamId?: string | null;
}

export const vercelAuth = (c: { token: string; meta: Record<string, unknown> }): VercelAuth => ({
  token: c.token,
  teamId: typeof c.meta.teamId === "string" ? c.meta.teamId : null,
});

async function vc<T>(auth: VercelAuth, path: string, init: RequestInit = {}): Promise<T> {
  const url = API + path + (auth.teamId ? `${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(auth.teamId)}` : "");
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const text = await res.text();
  let data: { error?: { message?: string; code?: string } } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: { message: text } };
  }
  if (!res.ok) {
    const msg = data.error?.message ?? text;
    if (res.status === 403 && data.error?.code === "integration_configuration_disabled") {
      throw new HttpError(409, "Your Vercel connection was disabled. Reconnect it from the Connections page.");
    }
    const hint = /git|repository|repo/i.test(msg)
      ? " Make sure the Vercel GitHub app is installed for this GitHub account (Vercel → Account Settings → Git)."
      : "";
    throw new HttpError(res.status, `Vercel ${res.status}: ${msg}${hint}`);
  }
  return data as T;
}

interface ProjectResponse {
  id: string;
  name: string;
}

export async function createProject(
  auth: VercelAuth,
  opts: { name: string; fullName: string; framework: string | null; env: Record<string, string> },
) {
  const environmentVariables = Object.entries(opts.env)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => ({ key, value, type: "encrypted", target: ["production", "preview", "development"] }));

  for (let i = 0; i < 6; i++) {
    const name = i === 0 ? opts.name : `${opts.name}-${i + 1}`;
    try {
      const project = await vc<ProjectResponse>(auth, "/v10/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          ...(opts.framework ? { framework: opts.framework } : {}),
          gitRepository: { type: "github", repo: opts.fullName },
          environmentVariables,
        }),
      });
      return { id: project.id, name: project.name };
    } catch (e) {
      if (e instanceof HttpError && e.status === 409) continue;
      throw e;
    }
  }
  throw new HttpError(409, `Vercel project name "${opts.name}" is taken. Pick another name.`);
}

interface DeploymentResponse {
  id: string;
  url: string;
  readyState: string;
  inspectorUrl?: string;
  alias?: string[];
}

export async function createDeployment(auth: VercelAuth, opts: { project: string; repoId: number; branch: string }) {
  const d = await vc<DeploymentResponse>(auth, "/v13/deployments?forceNew=1", {
    method: "POST",
    body: JSON.stringify({
      name: opts.project,
      project: opts.project,
      target: "production",
      gitSource: { type: "github", repoId: opts.repoId, ref: opts.branch },
    }),
  });
  return { id: d.id, url: d.url, inspectorUrl: d.inspectorUrl };
}

interface DeploymentEvent {
  type?: string;
  text?: string;
  payload?: { text?: string };
}

async function failureTail(auth: VercelAuth, id: string): Promise<string[]> {
  try {
    const events = await vc<DeploymentEvent[]>(auth, `/v3/deployments/${id}/events?builds=1&direction=backward&limit=40`);
    return events
      .map((e) => e.text ?? e.payload?.text ?? "")
      .filter((t) => t && /error|failed|cannot|not found|missing/i.test(t))
      .slice(0, 6)
      .reverse();
  } catch {
    return [];
  }
}

export async function deploymentStatus(auth: VercelAuth, id: string) {
  const d = await vc<DeploymentResponse>(auth, `/v13/deployments/${id}`);
  const state = d.readyState;
  const aliases = (d.alias ?? []).slice().sort((a, b) => a.length - b.length);
  const host = aliases.find((a) => a.endsWith(".vercel.app")) ?? aliases[0] ?? d.url;
  return {
    state,
    liveUrl: host ? `https://${host}` : undefined,
    inspectorUrl: d.inspectorUrl,
    errors: state === "ERROR" ? await failureTail(auth, id) : [],
  };
}

export interface DeploymentSummary {
  id: string;
  state: string;
  target: string | null;
  createdAt: number;
  commitMessage: string | null;
}

export async function listDeployments(auth: VercelAuth, projectId: string, limit = 5): Promise<DeploymentSummary[]> {
  const r = await vc<{
    deployments: {
      uid: string;
      state?: string;
      readyState?: string;
      target?: string | null;
      created: number;
      meta?: { githubCommitMessage?: string };
    }[];
  }>(auth, `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=${limit}`);
  return r.deployments.map((d) => ({
    id: d.uid,
    state: d.state ?? d.readyState ?? "UNKNOWN",
    target: d.target ?? null,
    createdAt: d.created,
    commitMessage: d.meta?.githubCommitMessage?.split("\n")[0] ?? null,
  }));
}
