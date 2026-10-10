// A sample report that draws itself when it scrolls into view. The numbers are made up and labelled
// as such; the real dashboard shows each project's own traffic.

const PAGEVIEWS = [18, 22, 20, 27, 31, 29, 38, 44, 41, 52, 49, 58, 66, 61, 72, 84, 79, 91, 88, 104, 98, 112, 121, 117, 133, 142, 138, 156, 149, 168];
const VISITORS = PAGEVIEWS.map((v, i) => Math.round(v * (0.52 + 0.06 * Math.sin(i / 2.3))));

const W = 640;
const H = 220;
const PAD = { l: 8, r: 8, t: 14, b: 22 };
const top = 180;

const x = (i: number) => PAD.l + (i / (PAGEVIEWS.length - 1)) * (W - PAD.l - PAD.r);
const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / top);
const line = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

export default function ReportMock() {
  const last = PAGEVIEWS.length - 1;
  return (
    <div className="lp-mock">
      <div className="lp-mock-head">
        <span className="lp-mock-title">my-portfolio · last 30 days</span>
        <span className="lp-sample">Sample data</span>
      </div>
      <div className="lp-figs">
        <div><span>Visitors</span><b>1,284</b><em>▲ 18% vs previous</em></div>
        <div><span>Page views</span><b>3,906</b><em>▲ 12% vs previous</em></div>
        <div><span>Events</span><b>412</b><em>▲ 9% vs previous</em></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sample line chart of page views and visitors rising over thirty days.">
        <defs>
          <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#8b7bff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#8b7bff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 60, 120, 180].map((t) => (
          <line key={t} className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
        ))}
        <path className="ar" d={`${line(PAGEVIEWS)} L${x(last)} ${y(0)} L${x(0)} ${y(0)} Z`} />
        <path className="ln b" pathLength={1} d={line(PAGEVIEWS)} />
        <path className="ln o" pathLength={1} d={line(VISITORS)} />
        <circle className="dot" cx={x(last)} cy={y(PAGEVIEWS[last])} r="4.5" />
        <text x={PAD.l} y={H - 4}>30 days ago</text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end">today</text>
      </svg>
      <div className="lp-key">
        <span><i style={{ background: "var(--teal)" }} />Page views</span>
        <span><i style={{ background: "var(--tungsten)" }} />Visitors</span>
      </div>
      <div className="lp-top">
        <div className="lp-top-h">Top pages</div>
        {[["/", 62], ["/projects", 24], ["/about", 14]].map(([name, pct]) => (
          <div key={name as string} className="lp-top-r">
            <span>{name}</span>
            <i><u style={{ width: `${pct}%` }} /></i>
            <b>{pct}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
