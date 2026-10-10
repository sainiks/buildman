"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { detect, TEXT_KEYS, type Plan } from "@/lib/detect";
import { parseDotenv } from "@/lib/dotenv";
import { decodeText, formatBytes, ingestFiles, ingestZip, readDrop, type Ingested, type PathedFile } from "@/lib/files";
import { ship, type Options, type Result, type Step, type StepId } from "@/lib/pipeline";
import { slugify } from "@/lib/slug";

type Stage = "pick" | "review" | "run";
interface Connected {
  github: boolean;
  vercel: boolean;
  supabase: boolean;
}

type Wanted = "vercel" | "supabase";
const NAMES: Record<Wanted, string> = { vercel: "Vercel", supabase: "Supabase" };

const ENV_FILES =[".env", ".env.local", ".env.production"]; // later wins
const SKIP_ENV = /^(VERCEL|NODE_ENV$|NEXT_RUNTIME)/;
const LOCAL_VALUE = /localhost|127\.0\.0\.1|0\.0\.0\.0/;

function initialSteps(): Step[] {
  return [
    { id: "repo", label: "Create GitHub repo", state: "pending" },
    { id: "upload", label: "Upload files", state: "pending" },
    { id: "commit", label: "Commit to main", state: "pending" },
    { id: "db", label: "Supabase database", state: "pending" },
    { id: "vercel", label: "Create Vercel project", state: "pending" },
    { id: "deploy", label: "Deploy to production", state: "pending" },
  ];
}

export default function Ship({ initial }: { initial: Connected }) {
  const [connected, setConnected] = useState<Connected>(initial);
  const [stage, setStage] = useState<Stage>("pick");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [ingested, setIngested] = useState<Ingested | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [envNotes, setEnvNotes] = useState<string[]>([]);
  const [opts, setOpts] = useState<Options>({
    name: "",
    isPrivate: true,
    deploy: true,
    createDb: true,
    runMigrations: true,
    tracking: true,
    region: "ap-south-1",
  });
  const [steps, setSteps] = useState<Step[]>(initialSteps());
  const [result, setResult] = useState<Result>({ notes: [] });
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [copied, setCopied] = useState(false);

  const [connecting, setConnecting] = useState<Wanted | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function recheckConnections() {
    const res = await fetch("/api/connections");
    if (!res.ok) return;
    const data = (await res.json()) as { providers: { id: keyof Connected; connection: unknown }[] };
    const next = { github: false, vercel: false, supabase: false };
    for (const p of data.providers) next[p.id] = Boolean(p.connection);
    setConnected(next);
    return next;
  }

  // Just-in-time connect: open the service's sign-in in a pop-up (the uploaded project stays in this
  // page's memory), then poll until the connection shows up or the pop-up is closed.
  function connect(id: Wanted) {
    setConnectError(null);
    const path = `/api/oauth/${id}/start?return=${encodeURIComponent(`/connect-done?provider=${id}`)}`;
    const popup = window.open(path, `buildman-connect-${id}`, "popup=yes,width=520,height=720");
    if (!popup) {
      setConnectError("Your browser blocked the pop-up. Allow pop-ups for this site and press Connect again.");
      return;
    }
    setConnecting(id);
    if (pollRef.current) clearInterval(pollRef.current);
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      let now: Connected | undefined;
      try {
        now = await recheckConnections();
      } catch {
        // transient network error; keep polling
      }
      const done = now?.[id];
      const gone = popup.closed;
      if (done || gone || Date.now() - started > 10 * 60_000) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setConnecting(null);
        if (done) {
          // Vercel's page may still be finishing its install step; close it shortly after.
          setTimeout(() => { try { popup.close(); } catch {} }, 5000);
        } else if (gone) {
          setConnectError(`${NAMES[id]} wasn't connected. Press Connect to try again.`);
        }
      }
    }, 1500);
  }

  async function analyze(data: Ingested) {
    if (data.entries.length === 0) {
      setError("No project files found. Check that the zip or folder isn't empty.");
      return;
    }
    const pushable = data.entries.filter((e) => !e.secret);

    const text: Record<string, string> = {};
    for (const key of TEXT_KEYS) {
      const entry = pushable.find((e) => e.path === key);
      if (entry) {
        const decoded = decodeText(await entry.read());
        if (decoded !== null) text[key] = decoded;
      }
    }
    const nextPlan = detect({ paths: pushable.map((e) => e.path), text });

    // Local .env values become Vercel env vars (never committed).
    const merged: Record<string, string> = {};
    for (const file of ENV_FILES) {
      const entry = data.entries.find((e) => e.secret && e.path === file);
      if (entry) {
        const decoded = decodeText(await entry.read());
        if (decoded) Object.assign(merged, parseDotenv(decoded));
      }
    }
    const kept: Record<string, string> = {};
    let skippedLocal = 0;
    for (const [k, v] of Object.entries(merged)) {
      if (!v || SKIP_ENV.test(k)) continue;
      if (LOCAL_VALUE.test(v)) {
        skippedLocal++;
        continue;
      }
      kept[k] = v;
    }
    const notes: string[] = [];
    if (skippedLocal) notes.push(`${skippedLocal} env var(s) pointing to localhost were left out.`);
    if (data.entries.some((e) => e.secret)) notes.push("Local .env files are not pushed to GitHub. Their values go to Vercel instead.");

    setIngested(data);
    setPlan(nextPlan);
    setEnvVars(kept);
    setEnvNotes(notes);
    setOpts((o) => ({ ...o, name: slugify(data.name) || "my-project", createDb: true, runMigrations: true }));
    setStage("review");
  }

  async function guarded(fn: () => Promise<void>, what: string) {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(`Couldn't read that ${what}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const handleZip = (file: File) => guarded(async () => analyze(await ingestZip(file)), "zip");
  const handleFiles = (files: PathedFile[]) => guarded(async () => analyze(ingestFiles(files)), "folder");

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    setLoading(true);
    try {
      const dropped = await readDrop(e.dataTransfer);
      if (dropped.zip) await handleZip(dropped.zip);
      else if (dropped.files?.length) await handleFiles(dropped.files);
      else setError("Drop a .zip file or a project folder.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStage("pick");
    setIngested(null);
    setPlan(null);
    setSteps(initialSteps());
    setResult({ notes: [] });
    setError(null);
    setFinished(false);
    setShowPass(false);
  }

  const needsVercel = opts.deploy;
  const needsSupabase = Boolean(plan?.needsDb && opts.createDb);
  const missingIds = ([needsVercel && !connected.vercel && "vercel", needsSupabase && !connected.supabase && "supabase"].filter(Boolean)) as Wanted[];

  async function start() {
    if (!ingested || !plan) return;
    setStage("run");
    setRunning(true);
    setFinished(false);
    setError(null);
    setSteps(initialSteps());
    const fresh: Result = { notes: [] };
    setResult(fresh);

    const setStep = (id: StepId, patch: Partial<Step>) =>
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    let latest: Result = fresh;
    const addResult = (patch: Partial<Result>, note?: string) => {
      latest = { ...latest, ...patch, notes: note ? [...latest.notes, note] : latest.notes };
      setResult(latest);
    };

    try {
      await ship({ opts, entries: ingested.entries, plan, envVars }, setStep, addResult);
      setFinished(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSteps((prev) => prev.map((s) => (s.state === "running" ? { ...s, state: "error", detail: undefined } : s)));
    } finally {
      setRunning(false);
    }
  }

  async function copyPassword() {
    if (!result.dbPassword) return;
    try {
      await navigator.clipboard.writeText(result.dbPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the password is on screen.
    }
  }

  const pushable = ingested?.entries.filter((e) => !e.secret) ?? [];
  const totalBytes = pushable.reduce((n, e) => n + e.size, 0);
  const envNames = Object.keys(envVars);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="head" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="h1">New project</h1>
          <p className="sub">Drop a zip or folder. Buildman does the rest.</p>
        </div>
      </div>

      {error && stage !== "run" && <p className="err" style={{ marginBottom: 12 }}>{error}</p>}

      {stage === "pick" && (
        <div className="stack">
          <div
            className={`drop${dragOver ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <p>
              <strong>{loading ? "Reading your project…" : "Drop a .zip or a project folder here"}</strong>
              <br />
              On a phone, choose a zip from Files.
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="primary" onClick={() => zipRef.current?.click()} disabled={loading}>Choose .zip</button>
              <button onClick={() => folderRef.current?.click()} disabled={loading}>Choose folder</button>
            </div>
            <input
              ref={zipRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleZip(f);
                e.target.value = "";
              }}
            />
            <input
              ref={folderRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const list = [...(e.target.files ?? [])].map((file) => ({
                  file,
                  path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
                }));
                if (list.length) void handleFiles(list);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      )}

      {stage === "review" && plan && ingested && (
        <div className="card">
          <label className="field">
            <span>Project name (used for GitHub, Vercel and Supabase)</span>
            <input
              type="text"
              value={opts.name}
              onChange={(e) => setOpts({ ...opts, name: e.target.value })}
              onBlur={() => setOpts((o) => ({ ...o, name: slugify(o.name) }))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          <div className="badges">
            <span className="badge on">{plan.frameworkLabel}</span>
            <span className="badge">{pushable.length} files · {formatBytes(totalBytes)}</span>
            <span className="badge">{plan.needsDb ? "Database needed" : "No database"}</span>
            {envNames.length > 0 && <span className="badge">{envNames.length} env vars</span>}
            {plan.migrations.length > 0 && <span className="badge">{plan.migrations.length} SQL file(s)</span>}
          </div>

          {plan.needsDb && <p className="sub small" style={{ marginBottom: 12 }}>Detected because it {plan.dbReasons.join(", ")}.</p>}

          {(plan.warnings.length > 0 || envNotes.length > 0) && (
            <ul className="notes">
              {[...plan.warnings, ...envNotes].map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}

          <div className="toggles">
            <label className="toggle">
              <input type="checkbox" checked={opts.isPrivate} onChange={(e) => setOpts({ ...opts, isPrivate: e.target.checked })} />
              <span>Private repository</span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={opts.deploy} onChange={(e) => setOpts({ ...opts, deploy: e.target.checked })} />
              <span>Deploy to Vercel</span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={opts.tracking} onChange={(e) => setOpts({ ...opts, tracking: e.target.checked })} />
              <span>
                Add traffic tracking
                <small>One script tag, no cookies. Powers the visitor numbers on your dashboard.</small>
              </span>
            </label>
            {plan.needsDb && (
              <>
                <label className="toggle">
                  <input type="checkbox" checked={opts.createDb} onChange={(e) => setOpts({ ...opts, createDb: e.target.checked })} />
                  <span>
                    Create a Supabase project
                    <small>Region {opts.region}. Its keys are added to Vercel automatically.</small>
                  </span>
                </label>
                {plan.migrations.length > 0 && (
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={opts.runMigrations}
                      disabled={!opts.createDb}
                      onChange={(e) => setOpts({ ...opts, runMigrations: e.target.checked })}
                    />
                    <span>Run the SQL files on the new database</span>
                  </label>
                )}
              </>
            )}
          </div>

          {missingIds.length > 0 && (
            <div className="notice" style={{ marginBottom: 14 }}>
              <p>
                This project needs {missingIds.map((m) => NAMES[m]).join(" and ")}. Connect in a small window; your files stay here.
              </p>
              <div className="row" style={{ marginTop: 10 }}>
                {missingIds.map((m) => (
                  <button key={m} type="button" className="primary" disabled={connecting === m} onClick={() => connect(m)}>
                    {connecting === m ? `Waiting for ${NAMES[m]}…` : `Connect ${NAMES[m]}`}
                  </button>
                ))}
              </div>
              {connectError && <p className="err" style={{ marginTop: 8 }}>{connectError}</p>}
              <p className="small sub" style={{ marginTop: 8 }}>Or turn that option off above to skip it.</p>
            </div>
          )}

          <button className="primary wide" onClick={start} disabled={!opts.name || missingIds.length > 0}>Ship it</button>
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button className="linkish" onClick={reset}>Pick a different project</button>
          </div>
        </div>
      )}

      {stage === "run" && (
        <div className="stack">
          <div className="card">
            <h2 className="h2">{finished ? "Done" : error ? "Stopped" : "Shipping"}</h2>
            <ol className="steps">
              {steps.map((s) => (
                <li key={s.id} className={`step ${s.state}`}>
                  <span className="dot" aria-hidden />
                  <span>
                    <b>{s.label}</b>
                    {s.detail && <small>{s.detail}</small>}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {error && <p className="err">{error}</p>}

          {result.notes.length > 0 && (
            <ul className="notes">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          )}

          {(result.repoUrl || result.liveUrl || result.supabaseRef) && (
            <div className="card">
              <h2 className="h2">Links</h2>
              <div className="links">
                {result.projectId && (
                  <Link className="btn primary" href={`/projects/${result.projectId}`}>Open project dashboard</Link>
                )}
                {result.liveUrl && (
                  <a className="btn" href={result.liveUrl} target="_blank" rel="noreferrer">
                    Live site <small>{result.liveUrl.replace("https://", "")}</small>
                  </a>
                )}
                {result.repoUrl && (
                  <a className="btn" href={result.repoUrl} target="_blank" rel="noreferrer">
                    GitHub repo <small>{result.repoFullName}</small>
                  </a>
                )}
                {result.inspectorUrl && (
                  <a className="btn" href={result.inspectorUrl} target="_blank" rel="noreferrer">
                    Vercel deployment <small>build logs</small>
                  </a>
                )}
                {result.supabaseRef && (
                  <a className="btn" href={`https://supabase.com/dashboard/project/${result.supabaseRef}`} target="_blank" rel="noreferrer">
                    Supabase dashboard <small>{result.supabaseRef}</small>
                  </a>
                )}
              </div>
              {result.dbPassword && (
                <>
                  <p className="sub small" style={{ marginTop: 14 }}>
                    Database password. Save it now: Buildman doesn&apos;t store it.
                  </p>
                  <div className="secret">
                    <code>{showPass ? result.dbPassword : "•".repeat(20)}</code>
                    <button onClick={() => setShowPass((v) => !v)}>{showPass ? "Hide" : "Show"}</button>
                    <button onClick={copyPassword}>{copied ? "Copied" : "Copy"}</button>
                  </div>
                </>
              )}
            </div>
          )}

          {!running && (
            <button className="primary wide" onClick={reset}>{finished ? "Ship another project" : "Back"}</button>
          )}
        </div>
      )}
    </div>
  );
}
