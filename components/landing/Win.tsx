// A small browser-style window that frames an animated scene. Its animations stay paused until the
// window scrolls into view (LandingFX adds `.in` to every `.scene`).
export default function Win({ title, children, label }: { title: string; children: React.ReactNode; label: string }) {
  return (
    <div className="win scene" role="img" aria-label={label}>
      <div className="win-bar" aria-hidden>
        <i /><i /><i />
        <span>{title}</span>
      </div>
      <div className="win-body" aria-hidden>
        <div className="sc-inner">{children}</div>
      </div>
    </div>
  );
}
