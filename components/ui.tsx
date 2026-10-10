import Link from "next/link";
import CountUp from "@/components/CountUp";
import type { ProjectRow } from "@/lib/db";
import { RANGES, deltaPct, full } from "@/lib/format";

export function Delta({ now, before, days }: { now: number; before: number; days: number }) {
  const pct = deltaPct(now, before);
  if (pct === null) return <div className="delta">{now > 0 ? "No data in the previous period" : " "}</div>;
  if (pct === 0) return <div className="delta">No change vs previous {days} days</div>;
  // Icon + sign + words, never color alone.
  const up = pct > 0;
  return (
    <div className={`delta ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% {up ? "up" : "down"} vs previous {days} days
    </div>
  );
}

export function StatTile(props: { label: string; now: number; before: number; days: number; hero?: boolean }) {
  return (
    <div className={`tile${props.hero ? " hero" : ""}`} title={full(props.now)}>
      <div className="label">{props.label}</div>
      <div className="value"><CountUp value={props.now} /></div>
      <Delta now={props.now} before={props.before} days={props.days} />
    </div>
  );
}

export function RangeLinks({ days, base }: { days: number; base: string }) {
  return (
    <nav className="ranges" aria-label="Date range">
      {RANGES.map((r) => (
        <Link key={r} href={`${base}?days=${r}`} aria-current={r === days ? "true" : undefined} scroll={false}>
          {r} days
        </Link>
      ))}
    </nav>
  );
}

const STATUS_LABEL: Record<ProjectRow["status"], string> = {
  creating: "Setting up",
  building: "Building",
  live: "Live",
  failed: "Failed",
};

export function StatusChip({ status }: { status: ProjectRow["status"] }) {
  return (
    <span className={`chip ${status}`}>
      <i aria-hidden /> {STATUS_LABEL[status]}
    </span>
  );
}

/** How far a project got: repo, database (only if it has one), deploy, live. */
export function RouteTrack({ project }: { project: ProjectRow }) {
  const stops: { label: string; done: boolean; fail?: boolean }[] = [
    { label: "Repo", done: Boolean(project.repo_url) },
    ...(project.supabase_ref ? [{ label: "Database", done: true }] : []),
    { label: "Deploy", done: Boolean(project.vercel_project_id) },
    { label: project.status === "failed" ? "Build failed" : "Live", done: project.status === "live", fail: project.status === "failed" },
  ];
  return (
    <ol className="route" aria-label="Setup progress">
      {stops.map((s) => (
        <li key={s.label} className={s.fail ? "fail" : s.done ? "done" : undefined}>
          <span className="n" aria-hidden />
          {s.label}
        </li>
      ))}
    </ol>
  );
}
