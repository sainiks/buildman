"use client";

import { useEffect, useRef, useState } from "react";
import { full, shortDate } from "@/lib/format";

export interface DailyPoint {
  day: string;
  pageviews: number;
  visitors: number;
  events: number;
}

const HEIGHT = 240;
const M = { l: 44, r: 14, t: 12, b: 28 };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * pow) return m * pow;
  return 10 * pow;
}

export default function TrafficChart({ daily, label }: { daily: DailyPoint[]; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = daily.length;
  const total = daily.reduce((s, d) => s + d.pageviews, 0);
  const top = niceMax(Math.max(...daily.map((d) => d.pageviews), 1));
  const iw = width - M.l - M.r;
  const ih = HEIGHT - M.t - M.b;
  const x = (i: number) => M.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => M.t + ih - (v / top) * ih;

  const line = (key: "pageviews" | "visitors") =>
    daily.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");
  const area = `${line("pageviews")} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;

  const ticks = [0, 1, 2, 3, 4].map((t) => (top / 4) * t);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 80))));

  function nearest(clientX: number) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || n === 0) return;
    const rel = clientX - box.left - M.l;
    setHover(Math.min(n - 1, Math.max(0, Math.round((rel / iw) * (n - 1)))));
  }

  const h = hover !== null ? daily[hover] : null;
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover) + 12, 4), width - 170) : 0;

  return (
    <div>
      <div className="chart-head">
        <div className="legend" aria-hidden>
          <span><i style={{ borderColor: "var(--series-1)" }} />Page views</span>
          <span><i style={{ borderColor: "var(--series-2)" }} />Visitors</span>
        </div>
      </div>
      <div
        ref={wrap}
        className="chart"
        tabIndex={0}
        role="img"
        aria-label={`${label}: ${full(total)} page views over ${n} days. Use the left and right arrow keys to read each day.`}
        onPointerMove={(e) => nearest(e.clientX)}
        onPointerDown={(e) => nearest(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((p) => Math.min(n - 1, (p ?? -1) + 1));
          else if (e.key === "ArrowLeft") setHover((p) => Math.max(0, (p ?? n) - 1));
          else if (e.key === "Escape") setHover(null);
        }}
      >
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end">{full(t)}</text>
            </g>
          ))}
          {daily.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.day} x={x(i)} y={HEIGHT - 8} textAnchor={i === 0 ? "start" : "middle"}>{shortDate(d.day)}</text>
            ) : null,
          )}

          <path className="area" d={area} fill="var(--series-1)" opacity={0.1} />
          <path className="ln" pathLength={1} d={line("pageviews")} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <path className="ln" pathLength={1} d={line("visitors")} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {n > 0 && (
            <>
              <circle cx={x(n - 1)} cy={y(daily[n - 1].pageviews)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
              <circle cx={x(n - 1)} cy={y(daily[n - 1].visitors)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
            </>
          )}

          {h && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} stroke="var(--axis)" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(h.pageviews)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
              <circle cx={x(hover)} cy={y(h.visitors)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>

        {total === 0 && <div className="empty-chart">No visits recorded in this period yet.</div>}

        {h && hover !== null && (
          <div className="tip" style={{ left: tipLeft, top: M.t }}>
            <div className="d">{shortDate(h.day)}</div>
            <div className="r"><span className="k"><i style={{ borderColor: "var(--series-1)" }} />Page views</span><b>{full(h.pageviews)}</b></div>
            <div className="r"><span className="k"><i style={{ borderColor: "var(--series-2)" }} />Visitors</span><b>{full(h.visitors)}</b></div>
          </div>
        )}
      </div>

      <details className="table">
        <summary>View as table</summary>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Day</th><th>Page views</th><th>Visitors</th><th>Events</th></tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (
                <tr key={d.day}>
                  <td>{shortDate(d.day)}</td>
                  <td>{full(d.pageviews)}</td>
                  <td>{full(d.visitors)}</td>
                  <td>{full(d.events)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
