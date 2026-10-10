"use client";

import { useEffect, useRef, useState } from "react";
import { compact } from "@/lib/format";

/** A figure that counts up to its value once, when it first appears. Shows the final value without motion. */
export default function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    ran.current = true;
    const start = performance.now();
    const ms = 1100;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{compact(shown)}</>;
}
