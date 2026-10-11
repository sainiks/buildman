import Win from "./Win";

// Four short diagrams, one per promise. Pure CSS motion; captions carry the exact claim.

export default function Privacy() {
  return (
    <div className="pv-grid">
      <figure className="pv">
        <Win title="token vault" label="Diagram: an access token goes into a lock and comes out as encrypted text.">
          <div className="pv-vault">
            <span className="pv-chip pv-in">gho_16C7e4…</span>
            <div className="pv-lock"><i /><b /></div>
            <span className="pv-chip pv-out">v1.q8Zk3…</span>
          </div>
        </Win>
        <figcaption><b>Encrypted at rest.</b> Tokens are stored with AES-256-GCM and decrypted only to make a request for you.</figcaption>
      </figure>

      <figure className="pv">
        <Win title="analytics" label="Diagram: a visitor's hash changes every day, so nobody can be followed across days.">
          <div className="pv-days">
            <div className="pv-clock"><i /></div>
            <div className="pv-hash"><span className="h1">a3f9c27e1b04</span><span className="h2">7c1d58e0a9f3</span><span className="h3">e02b94d6c18a</span></div>
            <small>Same visitor, a new ID every day. No cookies, no stored IPs.</small>
          </div>
        </Win>
        <figcaption><b>Analytics without cookies.</b> No IPs stored, and site owners choose whether Do Not Track is honored.</figcaption>
      </figure>

      <figure className="pv">
        <Win title="github.com / your repositories" label="Diagram: of five repositories, only the one Buildman created lights up; the others stay untouched.">
          <ul className="pv-repos">
            {["notes", "college-labs", "my-portfolio", "dotfiles", "sih-demo"].map((r, i) => (
              <li key={r} className={r === "my-portfolio" ? "mine" : undefined} style={{ ["--i" as string]: i }}>
                <span>{r}</span>
                <em>{r === "my-portfolio" ? "created by Buildman" : "untouched"}</em>
              </li>
            ))}
          </ul>
        </Win>
        <figcaption><b>Honest about GitHub access.</b> GitHub can&apos;t limit sign-in to one repository, so approval covers all of them. Buildman only writes to the ones it ships.</figcaption>
      </figure>

      <figure className="pv">
        <Win title="buildman / connections" label="Diagram: a Vercel connection is switched off with one click.">
          <ul className="pv-conn">
            <li><span>GitHub</span><i className="sw on" /></li>
            <li><span>Vercel</span><i className="sw off" /></li>
            <li><span>Supabase</span><i className="sw on" /></li>
          </ul>
          <div className="pv-removed">Project removed from Buildman<br /><small>its repo and site are untouched</small></div>
        </Win>
        <figcaption><b>You stay in control.</b> Disconnect Vercel or Supabase any time. Removing a project never touches its repo or site.</figcaption>
      </figure>
    </div>
  );
}
