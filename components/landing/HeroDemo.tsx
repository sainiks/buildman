"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The whole product in one panel. Left: a project and a "Commit & push" button. Middle: the terminal
 * log. Right: the three services light up as the log reaches them. It plays once when it scrolls into
 * view, and again whenever you press the button or Cmd/Ctrl+Enter. Everything is an example; nothing is sent.
 */

const LINES: { t: string; ok?: boolean }[] = [
  { t: "$ buildman ship ./my-portfolio" },
  { t: "reading folder… 6 files, static site, database found" },
  { t: "creating github.com/you/my-portfolio", ok: true },
  { t: "git add . && git commit -m \"Initial commit\"", ok: true },
  { t: "git push origin main", ok: true },
  { t: "creating supabase database, running 3 migrations", ok: true },
  { t: "deploying to vercel, env vars set", ok: true },
  { t: "live at my-portfolio.vercel.app", ok: true },
  { t: "you typed zero git commands. we won't tell." },
];

const FILES = ["index.html", "styles.css", "package.json", "supabase/migrations/0001_init.sql"];

const SERVICES = [
  { k: "gh", name: "GitHub", start: 2, done: 5, idle: "Waiting for files", run: "Creating repository…", end: "github.com/you/my-portfolio" },
  { k: "sb", name: "Supabase", start: 5, done: 7, idle: "Waiting for a database", run: "Running migrations…", end: "Database ready, 3 migrations" },
  { k: "vc", name: "Vercel", start: 6, done: 8, idle: "Waiting for a repo", run: "Building…", end: "my-portfolio.vercel.app" },
] as const;

const ICONS: Record<string, React.ReactNode> = {
  gh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="5.5" r="2.2" /><circle cx="6" cy="18.5" r="2.2" /><circle cx="18" cy="9" r="2.2" /><path d="M6 7.7v8.6M18 11.2c0 3.6-6 2.4-11 5.6" /></svg>,
  sb: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>,
  vc: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l9 16H3z" /></svg>,
};

export default function HeroDemo() {
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  const run = useCallback(() => {
    if (running) return;
    clear();
    played.current = true;
    setShown(0);
    setRunning(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    LINES.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => {
        setShown(i + 1);
        if (i === LINES.length - 1) setRunning(false);
      }, reduce ? 0 : 500 + i * 650));
    });
  }, [running]);

  // play once when it scrolls into view
  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !played.current) { run(); io.disconnect(); }
    }, { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, [run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const done = shown === LINES.length;
  return (
    <div className="hd" ref={root}>
      <div className="hd-bar"><i /><i /><i /><span>buildman / ship</span><em className="lp-sample">Example</em></div>
      <div className="hd-grid">
        <section className="hd-col hd-proj" aria-label="Your project">
          <h3>my-portfolio</h3>
          <p className="hd-sub">6 files · static site · database</p>
          <ul className="hd-files">
            {FILES.map((f) => <li key={f}>{f}</li>)}
            <li className="hd-env"><s>.env</s><em>kept out of the repo</em></li>
          </ul>
          <button className="hd-btn" onClick={run} disabled={running}>
            {running ? "Pushing…" : done ? "Push again" : "Commit & push"}
            <kbd aria-hidden>⌘⏎</kbd>
          </button>
        </section>

        <section className="hd-col hd-term" role="log" aria-live="polite" aria-label="Example terminal output">
          {LINES.slice(0, shown).map((l, i) => (
            <div key={i} className={l.ok ? "ok" : undefined}>{l.t}</div>
          ))}
          <span className={`hd-caret${running ? " busy" : ""}`} aria-hidden />
          {shown === 0 && <div className="idle">Press the button, or just wait.</div>}
        </section>

        <section className="hd-col hd-svc" aria-label="Services">
          {SERVICES.map((s) => {
            const state = shown >= s.done ? "done" : shown >= s.start ? "run" : "idle";
            return (
              <div key={s.k} className={`hd-card ${state}`}>
                <span className="hd-ico">{ICONS[s.k]}</span>
                <div>
                  <b>{s.name}</b>
                  <small>{state === "done" ? s.end : state === "run" ? s.run : s.idle}</small>
                </div>
                <span className="hd-st" aria-hidden>
                  {state === "done" ? <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : state === "run" ? <i /> : null}
                </span>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
