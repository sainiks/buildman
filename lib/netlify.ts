import { HttpError } from "./env";

const API = "https://api.netlify.com/api/v1";

async function nl<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const text = await res.text();
  let data: { message?: string; error?: string; errors?: unknown } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    if (res.status === 401) throw new HttpError(409, "Your Netlify connection expired. Reconnect it from the Connections page.");
    const detail = data.message ?? data.error ?? text;
    const extra = data.errors ? ` ${JSON.stringify(data.errors)}` : "";
    throw new HttpError(res.status, `Netlify ${res.status}: ${detail}${extra}`);
  }
  return data as T;
}

interface SiteResponse {
  id: string;
  name: string;
  account_slug?: string;
  admin_url?: string;
  ssl_url?: string;
  url?: string;
}

/**
 * Creates a Netlify site linked to a GitHub repo through a deploy key. Netlify's API has no
 * one-call "connect GitHub" without its GitHub App, so: make a deploy key, the caller adds the
 * public key to the repo, then the site is created pointing at that key.
 */
export async function createDeployKey(token: string) {
  const k = await nl<{ id: string; public_key: string }>(token, "/deploy_keys", { method: "POST" });
  return { id: k.id, publicKey: k.public_key };
}

export async function createSite(
  token: string,
  opts: { name: string; fullName: string; repoId: number; branch: string; isPrivate: boolean; deployKeyId: string; cmd?: string; dir?: string },
) {
  for (let i = 0; i < 6; i++) {
    const name = i === 0 ? opts.name : `${opts.name}-${i + 1}`;
    try {
      const site = await nl<SiteResponse>(token, "/sites", {
        method: "POST",
        body: JSON.stringify({
          name,
          repo: {
            provider: "github",
            repo: opts.fullName,
            repo_id: opts.repoId,
            branch: opts.branch,
            private: opts.isPrivate,
            deploy_key_id: opts.deployKeyId,
            ...(opts.cmd ? { cmd: opts.cmd } : {}),
            ...(opts.dir ? { dir: opts.dir } : {}),
          },
        }),
      });
      return { id: site.id, name: site.name, accountSlug: site.account_slug ?? null, adminUrl: site.admin_url ?? null };
    } catch (e) {
      // Names are global on Netlify; 422 means taken or invalid.
      if (e instanceof HttpError && (e.status === 422 || e.status === 409)) continue;
      throw e;
    }
  }
  throw new HttpError(409, `Netlify site name "${opts.name}" is taken. Pick another name.`);
}

/** Sets site environment variables (all deploy contexts). */
export async function setEnv(token: string, accountSlug: string, siteId: string, env: Record<string, string>) {
  const entries = Object.entries(env).filter(([, v]) => v !== "");
  if (entries.length === 0) return 0;
  await nl(token, `/accounts/${encodeURIComponent(accountSlug)}/env?site_id=${encodeURIComponent(siteId)}`, {
    method: "POST",
    body: JSON.stringify(
      entries.map(([key, value]) => ({ key, scopes: ["builds", "functions", "runtime", "post-processing"], values: [{ value, context: "all" }] })),
    ),
  });
  return entries.length;
}

export async function accountSlugFor(token: string, known?: string | null): Promise<string> {
  if (known) return known;
  const accounts = await nl<{ slug: string }[]>(token, "/accounts");
  if (!accounts.length) throw new HttpError(400, "No Netlify team found on this connection.");
  return accounts[0].slug;
}

export async function triggerBuild(token: string, siteId: string) {
  const b = await nl<{ id: string; deploy_id?: string }>(token, `/sites/${encodeURIComponent(siteId)}/builds`, { method: "POST", body: "{}" });
  if (!b.deploy_id) throw new HttpError(502, "Netlify started a build but returned no deploy id.");
  return { buildId: b.id, deployId: b.deploy_id };
}

interface DeployResponse {
  id: string;
  state: string;
  ssl_url?: string;
  url?: string;
  admin_url?: string;
  deploy_ssl_url?: string;
  error_message?: string | null;
  created_at?: string;
  title?: string | null;
  context?: string;
}

export async function deployStatus(token: string, deployId: string) {
  const d = await nl<DeployResponse>(token, `/deploys/${encodeURIComponent(deployId)}`);
  const state = d.state; // new | pending_review | accepted | rejected | enqueued | building | uploading | uploaded | preparing | prepared | processing | processed | ready | error | retrying
  const mapped = state === "ready" ? "READY" : state === "error" ? "ERROR" : /enqueued|new/.test(state) ? "QUEUED" : "BUILDING";
  return {
    state: mapped,
    liveUrl: d.ssl_url ?? d.url,
    inspectorUrl: d.admin_url ? `${d.admin_url}/deploys/${d.id}` : undefined,
    errors: mapped === "ERROR" && d.error_message ? [d.error_message] : [],
  };
}

export async function listNetlifyDeploys(token: string, siteId: string, limit = 5) {
  const r = await nl<DeployResponse[]>(token, `/sites/${encodeURIComponent(siteId)}/deploys?per_page=${limit}`);
  return r.map((d) => ({
    id: d.id,
    state: d.state === "ready" ? "READY" : d.state === "error" ? "ERROR" : /enqueued|new/.test(d.state) ? "QUEUED" : "BUILDING",
    target: d.context ?? null,
    createdAt: d.created_at ? Date.parse(d.created_at) : Date.now(),
    commitMessage: d.title ?? null,
  }));
}
