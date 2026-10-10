// Browser-side orchestrator. Each step is a short API call so nothing hits serverless time or
// body-size limits; the browser drives polling and batching. Every call runs as the signed-in
// user, with that user's own GitHub / Vercel / Supabase connections.
import { bytesToBase64, decodeText, type Entry } from "./files";
import type { Plan } from "./detect";
import { installSnippet } from "./snippet";

export type StepId = "repo" | "upload" | "commit" | "db" | "vercel" | "deploy";
export type StepState = "pending" | "running" | "done" | "skipped" | "error";

export interface Step {
  id: StepId;
  label: string;
  state: StepState;
  detail?: string;
}

export interface Options {
  name: string;
  isPrivate: boolean;
  deploy: boolean;
  createDb: boolean;
  runMigrations: boolean;
  tracking: boolean;
  region: string;
}

export interface Result {
  projectId?: string;
  repoUrl?: string;
  repoFullName?: string;
  liveUrl?: string;
  inspectorUrl?: string;
  supabaseRef?: string;
  dbPassword?: string;
  notes: string[];
}

export interface Context {
  opts: Options;
  entries: Entry[];
  plan: Plan;
  envVars: Record<string, string>;
}

const MAX_FILE_BYTES = 3 * 1024 * 1024; // JSON + base64 must stay under the ~4.5 MB request cap
const MAX_BATCH_CHARS = 3_200_000;
const MAX_BATCH_FILES = 300;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Your session expired. Sign in again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
  return data as T;
}

interface RepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  id: number;
  htmlUrl: string;
  branch: string;
  parentSha: string;
  renamed: boolean;
}

interface PreparedFile {
  path: string;
  encoding: "utf8" | "base64";
  content: string;
  exec: boolean;
  weight: number;
}

async function prepare(entry: Entry, override?: string): Promise<PreparedFile> {
  let text: string | null;
  let content: string;
  if (override !== undefined) {
    text = override;
    content = override;
  } else {
    const bytes = await entry.read();
    text = bytes.byteLength === 0 ? null : decodeText(bytes);
    content = text ?? bytesToBase64(bytes);
  }
  return {
    path: entry.path,
    encoding: text === null ? "base64" : "utf8",
    content,
    exec: entry.exec,
    weight: content.length + entry.path.length + 64,
  };
}

export async function ship(
  ctx: Context,
  setStep: (id: StepId, patch: Partial<Step>) => void,
  addResult: (patch: Partial<Result>, note?: string) => void,
): Promise<void> {
  const { opts, entries, plan, envVars } = ctx;
  const dbWanted = opts.createDb && plan.needsDb;
  const files = entries.filter((e) => !e.secret);

  // 0. Project record + tracking snippet ---------------------------------------------------------
  setStep("repo", { state: "running", detail: "Preparing…" });
  const project = await api<{ id: string; publicKey: string; scriptUrl: string }>("projects", {
    name: opts.name,
    framework: plan.framework,
  });
  addResult({ projectId: project.id });

  const overrides = new Map<string, string>();
  let snippetInstalled = false;
  if (opts.tracking) {
    const textEntries = new Map(files.map((e) => [e.path, e]));
    const result = await installSnippet({
      paths: files.map((e) => e.path),
      publicKey: project.publicKey,
      scriptUrl: project.scriptUrl,
      read: async (path) => {
        const entry = textEntries.get(path);
        return entry ? decodeText(await entry.read()) : null;
      },
    });
    if (result) {
      overrides.set(result.path, result.content);
      snippetInstalled = true;
      addResult({}, `Traffic tracking added to ${result.path} (${result.where}).`);
    } else {
      addResult({}, "Couldn't find a safe place to add traffic tracking. The project page shows the one line to paste in.");
    }
  }

  // 1. Repo ------------------------------------------------------------------------------------
  const repo = await api<RepoInfo>("pipeline/repo", {
    projectId: project.id,
    name: opts.name,
    isPrivate: opts.isPrivate,
    snippetInstalled,
  });
  addResult({ repoUrl: repo.htmlUrl, repoFullName: repo.fullName });
  if (repo.renamed) addResult({}, `"${opts.name}" was taken on GitHub, so the repo is ${repo.fullName}.`);
  setStep("repo", { state: "done", detail: repo.fullName });

  // 2. Kick off the database now so it provisions while files upload ---------------------------
  type DbStart = { ref: string; dbPass: string };
  let dbStart: Promise<{ ok: true; v: DbStart } | { ok: false; e: Error }> | null = null;
  if (dbWanted) {
    setStep("db", { state: "running", detail: "Creating Supabase project…" });
    dbStart = api<DbStart>("pipeline/supabase/create", {
      projectId: project.id,
      name: opts.name,
      region: opts.region,
    }).then(
      (v) => ({ ok: true as const, v }),
      (e: Error) => ({ ok: false as const, e }),
    );
  } else {
    setStep("db", { state: "skipped", detail: plan.needsDb ? "Turned off" : "No database detected" });
  }

  // 3. Upload files in size-bounded batches ----------------------------------------------------
  setStep("upload", { state: "running", detail: `0 / ${files.length} files` });
  let treeSha: string | null = null;
  let uploaded = 0;
  let batch: PreparedFile[] = [];
  let batchWeight = 0;
  const skipped: string[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const res: { treeSha: string } = await api("pipeline/push", {
      projectId: project.id,
      baseTree: treeSha,
      files: batch.map(({ path, encoding, content, exec }) => ({ path, encoding, content, exec })),
    });
    treeSha = res.treeSha;
    uploaded += batch.length;
    batch = [];
    batchWeight = 0;
    setStep("upload", { detail: `${uploaded} / ${files.length} files` });
  };

  for (const entry of files) {
    if (entry.size > MAX_FILE_BYTES) {
      skipped.push(entry.path);
      continue;
    }
    const prepared = await prepare(entry, overrides.get(entry.path));
    if (batch.length > 0 && (batchWeight + prepared.weight > MAX_BATCH_CHARS || batch.length >= MAX_BATCH_FILES)) {
      await flush();
    }
    batch.push(prepared);
    batchWeight += prepared.weight;
  }
  await flush();
  if (skipped.length) {
    addResult(
      {},
      `${skipped.length} file(s) over 3 MB were skipped: ${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? "…" : ""}. Add them with git or the GitHub UI.`,
    );
  }
  if (!treeSha) throw new Error("Nothing to upload: every file was ignored or too large.");
  setStep("upload", { state: "done", detail: `${uploaded} files` });

  // 4. Commit ----------------------------------------------------------------------------------
  setStep("commit", { state: "running" });
  await api("pipeline/commit", {
    projectId: project.id,
    treeSha,
    parentSha: repo.parentSha,
    message: "Initial commit via Buildman",
  });
  setStep("commit", { state: "done", detail: repo.branch });

  // 5. Database: wait for it, then run SQL ------------------------------------------------------
  let supabase: DbStart | null = null;
  if (dbStart) {
    const started = await dbStart;
    if (!started.ok) throw new Error(`Supabase: ${started.e.message}`);
    supabase = started.v;
    addResult({ supabaseRef: supabase.ref, dbPassword: supabase.dbPass });

    setStep("db", { detail: "Provisioning (usually 1–2 min)…" });
    const deadline = Date.now() + 6 * 60_000;
    for (;;) {
      const { status } = await api<{ status: string }>(`pipeline/supabase/status?ref=${supabase.ref}`);
      if (status === "ACTIVE_HEALTHY") break;
      if (/FAILED|REMOVED|INIT_FAILED/.test(status)) throw new Error(`Supabase project ended in state ${status}.`);
      if (Date.now() > deadline) throw new Error("Supabase project took longer than 6 minutes to start.");
      await sleep(5000);
    }

    if (opts.runMigrations && plan.migrations.length > 0) {
      for (let i = 0; i < plan.migrations.length; i++) {
        const path = plan.migrations[i];
        setStep("db", { detail: `Running SQL ${i + 1} / ${plan.migrations.length}` });
        const entry = entries.find((e) => e.path === path);
        const sql = entry ? decodeText(await entry.read()) : null;
        if (sql === null) throw new Error(`Could not read ${path} as text.`);
        await api("pipeline/supabase/migrate", { projectId: project.id, name: path, sql });
      }
    }
    setStep("db", { state: "done", detail: `${supabase.ref}` });
  }

  // 6. Vercel ----------------------------------------------------------------------------------
  if (!opts.deploy) {
    setStep("vercel", { state: "skipped", detail: "Turned off" });
    setStep("deploy", { state: "skipped" });
    return;
  }
  setStep("vercel", { state: "running" });
  const vercelProject = await api<{ id: string; name: string; envCount: number }>("pipeline/vercel/project", {
    projectId: project.id,
    name: opts.name,
    framework: plan.framework,
    envVars,
    declaredEnv: plan.declaredEnv,
    dbPass: supabase?.dbPass ?? null,
  });
  setStep("vercel", { state: "done", detail: `${vercelProject.name} · ${vercelProject.envCount} env vars` });

  setStep("deploy", { state: "running", detail: "Queued" });
  const deployment = await api<{ id: string; url: string; inspectorUrl?: string }>("pipeline/vercel/deploy", {
    projectId: project.id,
  });
  addResult({ inspectorUrl: deployment.inspectorUrl });

  const deadline = Date.now() + 10 * 60_000;
  for (;;) {
    await sleep(4000);
    const s = await api<{ state: string; liveUrl?: string; inspectorUrl?: string; errors: string[] }>(
      `pipeline/vercel/status?id=${deployment.id}&projectId=${project.id}`,
    );
    if (s.state === "READY") {
      addResult({ liveUrl: s.liveUrl });
      setStep("deploy", { state: "done", detail: "Live" });
      return;
    }
    if (s.state === "ERROR" || s.state === "CANCELED") {
      throw new Error(`Vercel build ${s.state.toLowerCase()}.${s.errors.length ? `\n${s.errors.join("\n")}` : ""}`);
    }
    if (Date.now() > deadline) throw new Error("Deployment took longer than 10 minutes.");
    setStep("deploy", { detail: s.state === "BUILDING" ? "Building…" : "Queued" });
  }
}
