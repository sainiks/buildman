import type { ProjectRow } from "@/lib/db";
import { compact, full, timeAgo } from "@/lib/format";
import { platformStats, type Panel } from "@/lib/platform";

function Body<T>({ panel, children }: { panel: Panel<T>; children: (data: T) => React.ReactNode }) {
  if (panel.status === "ok") return <>{children(panel.data)}</>;
  return <p className={panel.status === "error" ? "notice bad" : "none"}>{panel.message}</p>;
}

const STATE: Record<string, string> = {
  READY: "Live",
  BUILDING: "Building",
  QUEUED: "Queued",
  INITIALIZING: "Starting",
  ERROR: "Failed",
  CANCELED: "Canceled",
};

export default async function PlatformPanel({ userId, project }: { userId: string; project: ProjectRow }) {
  const s = await platformStats(userId, project);
  return (
    <div className="grid3">
      <section className="card">
        <h2 className="h2">Deployments</h2>
        <Body panel={s.vercel}>
          {(list) =>
            list.length === 0 ? (
              <p className="none">No deployments yet.</p>
            ) : (
              <ul className="bars" style={{ gap: 12 }}>
                {list.map((d) => (
                  <li key={d.id} style={{ gridTemplateColumns: "1fr auto" }}>
                    <span className="name" title={d.commitMessage ?? undefined}>{d.commitMessage ?? (d.target === "production" ? "Production deploy" : "Preview deploy")}</span>
                    <span className="small sub">{STATE[d.state] ?? d.state} · {timeAgo(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )
          }
        </Body>
      </section>

      <section className="card">
        <h2 className="h2">Database requests</h2>
        <Body panel={s.supabase}>
          {(u) => (
            <div className="stack" style={{ gap: 10 }}>
              <div>
                <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-0.02em" }} title={full(u.total)}>{compact(u.total)}</div>
                <div className="small sub">Requests reported by Supabase</div>
              </div>
              <ul className="bars" style={{ gap: 6 }}>
                {[["Data (REST)", u.rest], ["Auth", u.auth], ["Storage", u.storage], ["Realtime", u.realtime]].map(([name, v]) => (
                  <li key={name as string} style={{ gridTemplateColumns: "1fr auto" }}>
                    <span className="name">{name}</span>
                    <span className="val">{full(v as number)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Body>
      </section>

      <section className="card">
        <h2 className="h2">Repository</h2>
        <Body panel={s.github}>
          {(g) => (
            <div className="stack" style={{ gap: 10 }}>
              <div>
                <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-0.02em" }}>
                  {g.commitsCapped ? "100+" : g.commitsLast7Days}
                </div>
                <div className="small sub">Commits in the last 7 days</div>
              </div>
              <ul className="bars" style={{ gap: 6 }}>
                {[["Stars", g.stars], ["Forks", g.forks], ["Open issues", g.openIssues]].map(([name, v]) => (
                  <li key={name as string} style={{ gridTemplateColumns: "1fr auto" }}>
                    <span className="name">{name}</span>
                    <span className="val">{full(v as number)}</span>
                  </li>
                ))}
              </ul>
              {g.pushedAt && <p className="small sub">Last push {timeAgo(g.pushedAt)}</p>}
            </div>
          )}
        </Body>
      </section>
    </div>
  );
}
