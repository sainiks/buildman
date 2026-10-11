// Shown instantly while a page's data loads, and used by Next to prefetch the page shell so
// switching between Dashboard, New project and Connections feels immediate.
export default function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      <div className="skel" style={{ width: 220, height: 30 }} />
      <div className="skel" style={{ width: "min(420px, 80%)", height: 14 }} />
      <div className="skel" style={{ height: 150, marginTop: 8 }} />
      <div className="skel" style={{ height: 150 }} />
    </div>
  );
}
