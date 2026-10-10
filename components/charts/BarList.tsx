import { full } from "@/lib/format";

export interface BarItem {
  name: string;
  value: number;
}

/** Ranked horizontal bars: label left, value at the tip. Every value is printed, so no tooltip is needed. */
export default function BarList({ items, empty = "Nothing yet." }: { items: BarItem[]; empty?: string }) {
  if (items.length === 0) return <p className="none">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="bars">
      {items.map((i) => (
        <li key={i.name} title={`${i.name}: ${full(i.value)}`}>
          <span className="name">{i.name}</span>
          <span className="val">{full(i.value)}</span>
          <span className="track" aria-hidden>
            <span className="fill" style={{ width: `${Math.max((i.value / max) * 100, 1)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
