import Win from "./Win";

// The three steps as little looping screens. All motion is CSS (landing.css, "scenes"); nothing here
// is interactive. Names and values in the scenes are examples.

const CURSOR = (
  <svg viewBox="0 0 22 22" width="22" height="22">
    <path d="M3 2l15 7-6.5 2L9 18z" fill="#fff" stroke="#07060d" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const TICK = (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Step 1: approve on GitHub. A cursor presses Authorize and the button turns into "Signed in". */
export function SceneSignIn() {
  return (
    <Win title="github.com/login/oauth" label="Animation: a cursor presses Authorize on GitHub's approval screen and Buildman signs you in.">
      <div className="sa-card">
        <div className="sa-mark" />
        <div className="sa-h">Buildman would like to<br />connect to your account</div>
        <ul className="sa-perms">
          <li style={{ ["--d" as string]: "0.1s" }}><b>{TICK}</b>Create repositories for you</li>
          <li style={{ ["--d" as string]: "0.55s" }}><b>{TICK}</b>Read your name and avatar</li>
        </ul>
        <div className="sa-btn"><span className="a">Authorize</span><span className="b">{TICK} Signed in</span></div>
      </div>
      <div className="sa-cur">{CURSOR}</div>
    </Win>
  );
}

/** Step 2: drop a folder; Buildman reads it and shows what it found. */
export function SceneDrop() {
  return (
    <Win title="buildman / new project" label="Animation: a folder is dragged into the drop area, Buildman detects a static site with a database and an env file, and the project name is typed.">
      <div className="sb-zone"><span>Drop a zip or folder</span></div>
      <div className="sb-folder"><i /></div>
      <div className="sb-cur">{CURSOR}</div>
      <div className="sb-chips">
        <span style={{ ["--d" as string]: 0 }}>{TICK} Static site</span>
        <span style={{ ["--d" as string]: 1 }}>{TICK} Database found</span>
        <span style={{ ["--d" as string]: 2 }}>{TICK} .env read</span>
      </div>
      <div className="sb-field"><em>Name</em><b><span>my-portfolio</span></b></div>
    </Win>
  );
}

/** Step 3: Vercel is needed, so a small sheet asks for it; then the steps tick off and the link appears. */
export function SceneShip() {
  const rows = ["Create GitHub repo", "Upload files", "Create database", "Deploy to Vercel"];
  return (
    <Win title="buildman / shipping" label="Animation: Buildman asks to connect Vercel, then creates the repository, uploads files, creates the database and deploys, ending with a live link.">
      <ul className="sc-rows">
        {rows.map((r, i) => (
          <li key={r} style={{ ["--i" as string]: i }}>
            <span className="st">
              <i className="p" /><i className="s" /><i className="d">{TICK}</i>
            </span>
            {r}
          </li>
        ))}
      </ul>
      <div className="sc-bar"><i /></div>
      <div className="sc-url"><i aria-hidden />my-portfolio.vercel.app</div>
      <div className="sc-veil" />
      <div className="sc-sheet">
        <b>This project needs Vercel</b>
        <span>Connect it in a small window.</span>
        <em>Connect Vercel</em>
      </div>
    </Win>
  );
}
