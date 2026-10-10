/** Decorative 2px trend line. The adjacent number carries the value, so this is aria-hidden. */
export default function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 36;
  const pad = 4;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />}
    </svg>
  );
}
