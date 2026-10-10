const ITEMS = ["Static HTML", "Next.js", "Vite", "SvelteKit", "Astro", "Nuxt", "Remix", "Gatsby", "Create React App", "Node"];

/** A slow band of the project types Buildman recognises. The list is repeated so the loop has no seam. */
export default function Marquee() {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined}>
      {ITEMS.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
  return (
    <div className="mq" role="group" aria-label="Project types Buildman recognises: Static HTML, Next.js, Vite, SvelteKit, Astro, Nuxt, Remix, Gatsby, Create React App, Node">
      <div className="mq-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
