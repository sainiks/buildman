// The graded backdrop shared by the landing page and the sign-in page: drifting teal and tungsten
// light leaks, a vignette, and a little film grain. Decorative only.
export default function Backdrop() {
  return (
    <>
      <div className="lp-grade" aria-hidden />
      <div className="lp-vignette" aria-hidden />
      <div className="lp-grain" aria-hidden />
    </>
  );
}
