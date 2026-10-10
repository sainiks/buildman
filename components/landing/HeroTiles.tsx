"use client";

import { useEffect, useRef } from "react";

/**
 * Tilted app tiles that float around the headline. They drift on their own and lean slightly away from
 * the pointer (each at its own depth). Decorative; hidden from assistive tech.
 */

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const TILES: { k: string; x: string; y: string; r: number; z: number; s: number; node: React.ReactNode }[] = [
  { k: "gh", x: "7%", y: "14%", r: -9, z: 22, s: 1.05, node: (
    <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>) },
  { k: "vc", x: "88%", y: "10%", r: 8, z: 16, s: 0.9, node: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l9 16H3z" /></svg> },
  { k: "sb", x: "3%", y: "58%", r: 7, z: 30, s: 0.95, node: (
    <svg viewBox="0 0 24 24" {...ICON} style={{ color: "#3be08a" }}><path d="M13.5 3L5 13.5h6L10.5 21 19 10.5h-6z" /></svg>) },
  { k: "fo", x: "90%", y: "52%", r: -7, z: 26, s: 1.1, node: (
    <svg viewBox="0 0 24 24" {...ICON} style={{ color: "#ff9bbd" }}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>) },
  { k: "env", x: "20%", y: "74%", r: 10, z: 14, s: 0.8, node: <span className="ht-txt">.env</span> },
  { k: "pk", x: "76%", y: "76%", r: -10, z: 18, s: 0.85, node: <span className="ht-txt">{"{ }"}</span> },
];

export default function HeroTiles() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", String((e.clientX / innerWidth - 0.5) * 2));
        el.style.setProperty("--my", String((e.clientY / innerHeight - 0.5) * 2));
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="ht" ref={ref} aria-hidden>
      {TILES.map((t, i) => (
        <div key={t.k} className="ht-pos" style={{ left: t.x, top: t.y, ["--z" as string]: t.z, ["--s" as string]: t.s }}>
          <div className="ht-tile" style={{ ["--r" as string]: `${t.r}deg`, animationDelay: `${i * -1.3}s` }}>{t.node}</div>
        </div>
      ))}
    </div>
  );
}
