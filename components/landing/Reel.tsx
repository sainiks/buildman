"use client";

import { useState } from "react";

/**
 * "What you get", as a reel. Four short scenes (repository, live site, database, variables) play in
 * turn. The progress bar under the active tab drives the timing: when it finishes, the next scene
 * starts. Hovering or focusing the reel pauses it; clicking a tab jumps to that scene. The contents
 * are examples. With reduced motion nothing advances on its own and every scene shows its end state.
 */

const TABS = ["Repository", "Live site", "Database", "Variables"] as const;

const TREE = [
  { t: "my-portfolio/", d: 0 },
  { t: "  index.html", d: 1 },
  { t: "  styles.css", d: 2 },
  { t: "  package.json", d: 3 },
  { t: "  supabase/migrations/0001_init.sql", d: 4 },
  { t: "  .gitignore", d: 5 },
];

const ROWS = [
  ["1", "Aarav", "12 Mar"],
  ["2", "Meera", "14 Mar"],
  ["3", "Kabir", "15 Mar"],
  ["4", "Zoya", "19 Mar"],
];

const VARS = [
  ["SUPABASE_URL", "https://••••••••.supabase.co"],
  ["SUPABASE_ANON_KEY", "eyJh••••••••••••"],
  ["SITE_NAME", "My Portfolio"],
];

function Panel({ i }: { i: number }) {
  if (i === 0)
    return (
      <div className="rl-grid">
        <div className="rl-code">
          {TREE.map((l) => (
            <div key={l.t} className="rl-line" style={{ ["--i" as string]: l.d }}>{l.t}</div>
          ))}
          <div className="rl-line rl-secret" style={{ ["--i" as string]: 6 }}><s>  .env</s><em>kept out of the repo</em></div>
        </div>
        <div className="rl-commit rl-line" style={{ ["--i" as string]: 7 }}>
          <div className="rl-branch"><i /><b>main</b></div>
          <div className="rl-msg">Initial commit</div>
          <div className="rl-meta">6 files pushed by Buildman</div>
        </div>
      </div>
    );
  if (i === 1)
    return (
      <div className="rl-browser">
        <div className="rl-url"><span>my-portfolio.vercel.app</span><b className="rl-b1">Building</b><b className="rl-b2">Ready</b></div>
        <div className="rl-prog"><i /></div>
        <div className="rl-site">
          <div className="rl-sk rl-sk-a" />
          <div className="rl-sk rl-sk-b" />
          <div className="rl-sk rl-sk-c" />
          <div className="rl-real">
            <h4>Hi, I&apos;m Aarav.</h4>
            <p>I build small, fast web things.</p>
            <span>See my work</span>
          </div>
        </div>
      </div>
    );
  if (i === 2)
    return (
      <div className="rl-grid">
        <div className="rl-table">
          <div className="rl-th"><span>id</span><span>name</span><span>joined</span></div>
          {ROWS.map((r, k) => (
            <div key={r[0]} className="rl-tr rl-line" style={{ ["--i" as string]: k + 1 }}>
              {r.map((c) => <span key={c}>{c}</span>)}
            </div>
          ))}
        </div>
        <div className="rl-migs">
          {["0001_init.sql", "0002_profiles.sql", "0003_policies.sql"].map((m, k) => (
            <div key={m} className="rl-mig rl-line" style={{ ["--i" as string]: k + 3 }}><b>✓</b>{m}</div>
          ))}
          <div className="rl-note rl-line" style={{ ["--i" as string]: 7 }}>Migrations applied</div>
        </div>
      </div>
    );
  return (
    <div className="rl-vars">
      {VARS.map((v, k) => (
        <div key={v[0]} className="rl-var rl-line" style={{ ["--i" as string]: k }}>
          <code>{v[0]}</code><span>{v[1]}</span><b>added to Vercel</b>
        </div>
      ))}
      <div className="rl-var rl-skip rl-line" style={{ ["--i" as string]: 3 }}>
        <code><s>API_URL</s></code><span><s>http://localhost:3000</s></span><b>skipped: local address</b>
      </div>
    </div>
  );
}

export default function Reel() {
  const [active, setActive] = useState(0);
  return (
    <div className="reel scene" onPointerEnter={(e) => e.currentTarget.classList.add("hold")} onPointerLeave={(e) => e.currentTarget.classList.remove("hold")} onFocus={(e) => e.currentTarget.classList.add("hold")} onBlur={(e) => e.currentTarget.classList.remove("hold")}>
      <div className="rl-tabs" role="tablist" aria-label="What Buildman creates">
        {TABS.map((t, i) => (
          <button
            key={t}
            role="tab"
            aria-selected={i === active}
            aria-controls="rl-panel"
            className={`rl-tab${i === active ? " on" : ""}`}
            onClick={() => setActive(i)}
          >
            <span>{t}</span>
            <i className="rl-bar">
              {i === active && <b key={active} onAnimationEnd={() => setActive((a) => (a + 1) % TABS.length)} />}
            </i>
          </button>
        ))}
      </div>
      <div className="rl-stage" id="rl-panel" role="tabpanel">
        <span className="lp-sample rl-tag">Example</span>
        <div key={active} className="rl-panel">
          <Panel i={active} />
        </div>
      </div>
    </div>
  );
}
