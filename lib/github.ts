import { HttpError, sleep } from "./env";
import { pool } from "./pool";

const API = "https://api.github.com";

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data: { message?: string; errors?: unknown } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    if (res.status === 401) throw new HttpError(409, "Your GitHub connection is no longer valid. Sign out and sign in again.");
    const extra = data.errors ? ` ${JSON.stringify(data.errors)}` : "";
    throw new HttpError(res.status, `GitHub ${res.status}: ${data.message ?? text}${extra}`);
  }
  return data as T;
}

interface RepoResponse {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  owner: { login: string };
}

async function waitForRef(token: string, fullName: string, branch: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    try {
      const ref = await gh<{ object: { sha: string } }>(token, `/repos/${fullName}/git/ref/heads/${branch}`);
      return ref.object.sha;
    } catch {
      await sleep(700);
    }
  }
  throw new HttpError(504, "GitHub created the repo but its first commit never appeared. Try again.");
}

/** Creates the repo in the user's account (auto-suffixing -2, -3… if taken) with an initial commit. */
export async function createRepo(token: string, base: string, isPrivate: boolean) {
  for (let i = 0; i < 6; i++) {
    const name = i === 0 ? base : `${base}-${i + 1}`;
    try {
      const repo = await gh<RepoResponse>(token, "/user/repos", {
        method: "POST",
        body: JSON.stringify({ name, private: isPrivate, auto_init: true, description: "Created with Buildman" }),
      });
      const parentSha = await waitForRef(token, repo.full_name, repo.default_branch);
      return {
        owner: repo.owner.login,
        repo: repo.name,
        fullName: repo.full_name,
        id: repo.id,
        htmlUrl: repo.html_url,
        branch: repo.default_branch,
        parentSha,
        renamed: name !== base,
      };
    } catch (e) {
      if (e instanceof HttpError && e.status === 422 && /already exists/i.test(e.message)) continue;
      throw e;
    }
  }
  throw new HttpError(409, `Repo name "${base}" and its numbered variants are all taken. Pick another name.`);
}

/** Returns the current repo metadata so a failed shipment can reuse its saved repository. */
export async function getRepo(token: string, fullName: string) {
  const repo = await gh<RepoResponse>(token, `/repos/${fullName}`);
  const parentSha = await waitForRef(token, repo.full_name, repo.default_branch);
  return {
    owner: repo.owner.login, repo: repo.name, fullName: repo.full_name, id: repo.id,
    htmlUrl: repo.html_url, branch: repo.default_branch, parentSha, renamed: false,
  };
}

export interface BatchFile {
  path: string;
  encoding: "utf8" | "base64";
  content: string;
  exec?: boolean;
}

/**
 * Adds a batch of files to a tree. Text goes inline in the tree call; binaries (and empty
 * files) become blobs first. Pass the previous batch's tree as `baseTree` to chain batches.
 */
export async function pushBatch(token: string, owner: string, repo: string, baseTree: string | null, files: BatchFile[]) {
  const shas = new Map<string, string>();
  await pool(
    files.filter((f) => f.encoding === "base64"),
    4,
    async (f) => {
      const blob = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: f.content, encoding: "base64" }),
      });
      shas.set(f.path, blob.sha);
    },
  );

  const tree = files.map((f) => ({
    path: f.path,
    mode: f.exec ? "100755" : "100644",
    type: "blob",
    ...(f.encoding === "base64" ? { sha: shas.get(f.path) } : { content: f.content }),
  }));

  const created = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ ...(baseTree ? { base_tree: baseTree } : {}), tree }),
  });
  return created.sha;
}

export async function commitTree(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  treeSha: string,
  parentSha: string,
  message: string,
) {
  const commit = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });
  return commit.sha;
}

export interface RepoActivity {
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string | null;
  commitsLast7Days: number;
  /** True when the 7-day count hit the 100-commit page limit. */
  commitsCapped: boolean;
  recent: { sha: string; message: string; date: string | null }[];
}

export async function repoActivity(token: string, fullName: string): Promise<RepoActivity> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [repo, commits] = await Promise.all([
    gh<{ stargazers_count: number; forks_count: number; open_issues_count: number; pushed_at: string | null }>(
      token,
      `/repos/${fullName}`,
    ),
    gh<{ sha: string; commit: { message: string; author: { date: string } | null } }[]>(
      token,
      `/repos/${fullName}/commits?per_page=100&since=${encodeURIComponent(since)}`,
    ).catch(() => []),
  ]);
  return {
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    pushedAt: repo.pushed_at,
    commitsLast7Days: commits.length,
    commitsCapped: commits.length >= 100,
    recent: commits.slice(0, 3).map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0].slice(0, 90),
      date: c.commit.author?.date ?? null,
    })),
  };
}

/** Reads a text file from the repo's branch. Returns null when it doesn't exist. */
export async function readRepoFile(token: string, fullName: string, path: string, branch: string) {
  try {
    const f = await gh<{ content: string; sha: string }>(
      token,
      `/repos/${fullName}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
    );
    return { sha: f.sha, text: Buffer.from(f.content, "base64").toString("utf8") };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}

export async function writeRepoFile(token: string, fullName: string, path: string, branch: string, text: string, sha: string, message: string) {
  await gh(token, `/repos/${fullName}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: Buffer.from(text, "utf8").toString("base64"), sha, branch }),
  });
}

/** Adds a read-only deploy key to the repo (Netlify uses it to clone). Needs admin on the repo. */
export async function addDeployKey(token: string, fullName: string, title: string, key: string) {
  const k = await gh<{ id: number }>(token, `/repos/${fullName}/keys`, {
    method: "POST",
    body: JSON.stringify({ title, key, read_only: true }),
  });
  return k.id;
}

/** Creates a push webhook on the repo (Netlify's hook URL) so pushes trigger builds. */
export async function addWebhook(token: string, fullName: string, url: string, events: string[]) {
  const h = await gh<{ id: number }>(token, `/repos/${fullName}/hooks`, {
    method: "POST",
    body: JSON.stringify({ name: "web", active: true, events, config: { url, content_type: "json", insecure_ssl: "0" } }),
  });
  return h.id;
}
