import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyButton, ReinstallTagButton, RemoveProjectButton } from "@/components/Actions";
import BarList from "@/components/charts/BarList";
import TrafficChart, { type DailyPoint } from "@/components/charts/TrafficChart";
import PlatformPanel from "@/components/PlatformPanel";
import { RangeLinks, RouteTrack, StatTile, StatusChip } from "@/components/ui";
import { appUrl } from "@/lib/config";
import { db, ok, type ProjectRow } from "@/lib/db";
import { parseRange } from "@/lib/format";
import { requireUserPage } from "@/lib/session";
import { snippetTag } from "@/lib/snippet";

interface Named { name: string; visitors?: number; views?: number; count?: number }
interface Stats {
  totals: { pageviews: number; visitors: number; events: number; prev_pageviews: number; prev_visitors: number; prev_events: number };
  daily: DailyPoint[];
  pages: Named[];
  referrers: Named[];
  countries: Named[];
  devices: Named[];
  events: Named[];
}

const DEVICE_LABEL: Record<string, string> = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet", unknown: "Unknown" };

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const user = await requireUserPage();
  const { id } = await params;
  const days = parseRange((await searchParams).days);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const project = ok(
    await db().from("projects").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    "Load project",
  ) as ProjectRow | null;
  if (!project) notFound();

  const stats = ok(await db().rpc("project_stats", { p_project: project.id, p_days: days }), "Load stats") as Stats;
  const t = stats.totals;
  const last = ok(
    await db().from("events").select("ts").eq("project_id", project.id).order("ts", { ascending: false }).limit(1).maybeSingle(),
    "Load last event",
  ) as { ts: string } | null;
  const tag = snippetTag(`${appUrl()}/t.js`, project.public_key);
  const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
  const country = (code: string) => {
    try {
      return regionNames.of(code) ?? code;
    } catch {
      return code;
    }
  };

  return (
    <>
      <p className="small" style={{ marginBottom: 8 }}><Link href="/dashboard" className="sub">← All projects</Link></p>
      <div className="head">
        <div className="stack" style={{ gap: 8 }}>
          <div className="row">
            <h1 className="h1">{project.name}</h1>
            <StatusChip status={project.status} />
          </div>
          <RouteTrack project={project} />
          <div className="row small">
            {project.live_url && <a href={project.live_url} target="_blank" rel="noreferrer">{project.live_url.replace("https://", "")}</a>}
            {project.repo_url && <a href={project.repo_url} target="_blank" rel="noreferrer">{project.repo_full_name}</a>}
            {project.supabase_ref && (
              <a href={`https://supabase.com/dashboard/project/${project.supabase_ref}`} target="_blank" rel="noreferrer">Supabase</a>
            )}
          </div>
        </div>
        <RangeLinks days={days} base={`/projects/${project.id}`} />
      </div>

      <div className="tiles">
        <StatTile hero label="Visitors" now={t.visitors} before={t.prev_visitors} days={days} />
        <StatTile label="Page views" now={t.pageviews} before={t.prev_pageviews} days={days} />
        <StatTile label="Events" now={t.events} before={t.prev_events} days={days} />
      </div>

      <section className="card" style={{ marginBottom: 12 }}>
        <h2 className="h2">Traffic</h2>
        <TrafficChart daily={stats.daily} label={project.name} />
        <p className="small sub" style={{ marginTop: 8 }}>
          Visitors are counted per day: someone who returns on another day counts again. Days are UTC.
        </p>
      </section>

      <div className="grid2" style={{ marginBottom: 12 }}>
        <section className="card">
          <h2 className="h2">Top pages</h2>
          <BarList items={stats.pages.map((p) => ({ name: p.name, value: p.views ?? 0 }))} empty="No page views yet." />
        </section>
        <section className="card">
          <h2 className="h2">Where visitors come from</h2>
          <BarList items={stats.referrers.map((r) => ({ name: r.name, value: r.visitors ?? 0 }))} empty="No visitors yet." />
        </section>
        <section className="card">
          <h2 className="h2">Countries</h2>
          <BarList items={stats.countries.map((c) => ({ name: country(c.name), value: c.visitors ?? 0 }))} empty="No location data yet. Countries appear for sites served by Vercel." />
        </section>
        <section className="card">
          <h2 className="h2">Devices</h2>
          <BarList items={stats.devices.map((d) => ({ name: DEVICE_LABEL[d.name] ?? d.name, value: d.visitors ?? 0 }))} empty="No visitors yet." />
        </section>
      </div>

      <section className="card" style={{ marginBottom: 12 }}>
        <h2 className="h2">Interactions</h2>
        <BarList
          items={stats.events.map((e) => ({ name: e.name, value: e.count ?? 0 }))}
          empty="No events yet. Clicks on links to other sites are tracked automatically; add data-buildman-event to track your own."
        />
      </section>

      <Suspense fallback={<section className="card"><p className="none">Loading Vercel, Supabase and GitHub stats…</p></section>}>
        <PlatformPanel userId={user.id} project={project} />
      </Suspense>

      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">{project.snippet_installed ? "Tracking is installed" : "Add tracking to your site"}</h2>
        <p className="sub small" style={{ marginBottom: 10 }}>
          {project.snippet_installed
            ? "Buildman added this line to your project. To count your own events, call window.buildman.track(\"signup\") or add data-buildman-event=\"signup\" to a button."
            : "Buildman couldn't find a safe place to add this itself. Paste it just before </head> (or </body>) on every page, then redeploy."}
        </p>
        <pre className="code">{tag}</pre>
        <p className="small" style={{ marginTop: 10 }}>
          {last ? `Last visit received ${new Date(last.ts).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.` : "No visits received yet."}
        </p>
        <div className="row" style={{ marginTop: 10, alignItems: "flex-start" }}>
          <CopyButton text={tag} label="Copy line" />
          {project.repo_full_name && <ReinstallTagButton id={project.id} />}
        </div>
        {!last && (
          <ul className="sub small" style={{ marginTop: 12, paddingLeft: 18 }}>
            <li>Open your live site in a normal tab. Ad blockers and some privacy browsers can still block the script.</li>
            <li>Right-click → View Source on the live site and search for <code>t.js</code>. If it points to localhost, press Reinstall.</li>
            <li>Ad blockers can hide tracking scripts. Try a private window with extensions off.</li>
          </ul>
        )}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Remove project</h2>
        <p className="sub small" style={{ marginBottom: 10 }}>Stops tracking here and deletes the analytics. Your repo, deployment and database stay where they are.</p>
        <RemoveProjectButton id={project.id} name={project.name} />
      </section>
    </>
  );
}
