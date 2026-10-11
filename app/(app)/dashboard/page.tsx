import Link from "next/link";
import Sparkline from "@/components/charts/Sparkline";
import TrafficChart, { type DailyPoint } from "@/components/charts/TrafficChart";
import { RangeLinks, RouteTrack, StatTile, StatusChip } from "@/components/ui";
import { listConnections } from "@/lib/connections";
import { db, ok, type ProjectRow } from "@/lib/db";
import { compact, parseRange } from "@/lib/format";
import { providerList } from "@/lib/providers";
import { requireUidPage } from "@/lib/session";

interface Totals {
  pageviews: number;
  visitors: number;
  events: number;
  prev_pageviews: number;
  prev_visitors: number;
  prev_events: number;
}
interface Overview {
  totals: Totals;
  daily: DailyPoint[];
  projects: { id: string; pageviews: number; visitors: number; events: number; prev_pageviews: number; spark: number[] }[];
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const uid = await requireUidPage();
  const days = parseRange((await searchParams).days);

  const [overviewRes, projectRows, connections] = await Promise.all([
    db().rpc("user_overview", { p_user: uid, p_days: days }),
    db().from("projects").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    listConnections(uid),
  ]);
  const overview = ok(overviewRes, "Load dashboard") as Overview;
  const projects = ok(projectRows, "Load projects") as ProjectRow[];
  const stats = new Map(overview.projects.map((p) => [p.id, p]));
  const t = overview.totals;

  if (projects.length === 0) {
    const missing = providerList.filter((p) => !connections.some((c) => c.provider === p.id));
    return (
      <div className="stack" style={{ maxWidth: 560 }}>
        <h1 className="h1">Ship your first project</h1>
        <p className="sub">
          Drop a zip or a folder. Buildman creates the GitHub repo, deploys it on Vercel and sets up a Supabase database
          if it needs one. Then this page shows how many people visit it.
        </p>
        {missing.length > 0 && (
          <p className="notice">
            Not connected yet: {missing.map((m) => m.name).join(", ")}. <Link href="/connections">Connect them</Link> to deploy automatically.
          </p>
        )}
        <div><Link href="/new" className="btn primary">New project</Link></div>
      </div>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <h1 className="h1">Your projects</h1>
          <p className="sub">Traffic across all of them, last {days} days.</p>
        </div>
        <div className="row">
          <RangeLinks days={days} base="/dashboard" />
          <Link href="/new" className="btn primary">New project</Link>
        </div>
      </div>

      <div className="tiles">
        <StatTile hero label="Visitors" now={t.visitors} before={t.prev_visitors} days={days} />
        <StatTile label="Page views" now={t.pageviews} before={t.prev_pageviews} days={days} />
        <StatTile label="Events" now={t.events} before={t.prev_events} days={days} />
      </div>

      <section className="card" style={{ marginBottom: 12 }}>
        <h2 className="h2">Traffic</h2>
        <TrafficChart daily={overview.daily} label="All projects" />
      </section>

      <div className="projects">
        {projects.map((p) => {
          const s = stats.get(p.id);
          return (
            <Link key={p.id} href={`/projects/${p.id}?days=${days}`} className="card pcard">
              <div className="row between">
                <span className="name">{p.name}</span>
                <StatusChip status={p.status} />
              </div>
              <RouteTrack project={p} />
              <div className="nums">
                <div>
                  <div className="big">{compact(s?.pageviews ?? 0)}</div>
                  <div className="small sub">page views · {compact(s?.visitors ?? 0)} visitors</div>
                </div>
                {s && s.spark.length > 1 && <Sparkline values={s.spark} />}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
