"use client";

import { useEffect } from "react";

/**
 * The page's only client script. It renders nothing; it wires four small behaviours onto the
 * server-rendered markup:
 *  - [data-focus], .draw-line, .lp-steps, .lp-mock, .lp-end, .sc: add `.in` once they scroll into view
 *  - hero copy drifts slower than the page (--p, 0..1 over the first screen)
 *  - the nav gets a frosted background after the first few pixels
 *  - rows follow the cursor with a soft spotlight (--mx / --my)
 * With reduced motion, everything is shown immediately and nothing drifts.
 */
export default function LandingFX() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lp");
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const targets = root.querySelectorAll<HTMLElement>("[data-focus], .draw-line, .lp-steps, .lp-mock, .lp-end, .scene, .reel");
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((t) => t.classList.add("in"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              io.unobserve(e.target);
            }
          }
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
      );
      targets.forEach((t) => io.observe(t));
    }

    const nav = root.querySelector<HTMLElement>(".lp-nav");
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        nav?.classList.toggle("scrolled", y > 12);
        if (!reduce) root.style.setProperty("--p", String(Math.min(1, Math.max(0, y / (window.innerHeight * 0.8)))));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const onMove = (e: PointerEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>(".lp-row");
      if (!row) return;
      const r = row.getBoundingClientRect();
      row.style.setProperty("--mx", `${e.clientX - r.left}px`);
      row.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    root.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      root.removeEventListener("pointermove", onMove);
    };
  }, []);

  return null;
}
