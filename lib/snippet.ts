// Adds the tracking <script> tag to an uploaded project before it is pushed. Pure string work,
// so it runs in the browser during upload. Returns null when no safe insertion point exists
// (the project page then shows the tag for manual install).

export interface SnippetInput {
  paths: string[];
  read: (path: string) => Promise<string | null>;
  publicKey: string;
  scriptUrl: string;
}

export interface SnippetResult {
  path: string;
  content: string;
  /** Short label for the UI, e.g. "Next.js layout". */
  where: string;
}

export function snippetTag(scriptUrl: string, publicKey: string): string {
  // data-dnt="ignore": count every visit, including browsers that send Do Not Track (e.g. Chrome on
  // phones with it switched on). The tracker still stores no cookies and no IPs.
  return `<script defer src="${scriptUrl}" data-key="${publicKey}" data-dnt="ignore"></script>`;
}

interface Target {
  match: RegExp;
  where: string;
  /** Closing tag the snippet goes in front of. */
  anchor: RegExp;
  /** Concrete paths to try when reading a repo directly (no file listing needed). */
  paths: string[];
}

const TARGETS: Target[] = [
  { match: /^(src\/)?app\/layout\.(tsx|jsx|js)$/, where: "Next.js app layout", anchor: /<\/body>/i, paths: ["app/layout.tsx", "src/app/layout.tsx", "app/layout.jsx", "app/layout.js", "src/app/layout.jsx", "src/app/layout.js"] },
  { match: /^(src\/)?pages\/_document\.(tsx|jsx|js)$/, where: "Next.js document", anchor: /<\/Head>/, paths: ["pages/_document.tsx", "pages/_document.jsx", "pages/_document.js", "src/pages/_document.tsx", "src/pages/_document.jsx", "src/pages/_document.js"] },
  { match: /^index\.html$/, where: "index.html", anchor: /<\/head>/i, paths: ["index.html"] },
  { match: /^(public|src)\/index\.html$/, where: "index.html", anchor: /<\/head>/i, paths: ["public/index.html", "src/index.html"] },
];

/** Matches any Buildman/Gitman tracking tag for this key, whatever host it points at. */
function staleTag(publicKey: string): RegExp {
  return new RegExp(`<script[^>]*data-key=["']${publicKey}["'][^>]*>\\s*</script>\\n?`, "g");
}

/** Pure: returns the source with exactly one correct tag, or null when nothing needs changing / no anchor. */
export function refreshTag(source: string, target: { anchor: RegExp }, scriptUrl: string, publicKey: string): string | null {
  const tag = snippetTag(scriptUrl, publicKey);
  const cleaned = source.replace(staleTag(publicKey), "");
  const at = cleaned.search(target.anchor);
  if (at === -1) return null;
  const next = `${cleaned.slice(0, at)}${tag}\n${cleaned.slice(at)}`;
  return next === source ? null : next;
}

export const SNIPPET_TARGETS = TARGETS;

export async function installSnippet(input: SnippetInput): Promise<SnippetResult | null> {
  const tag = snippetTag(input.scriptUrl, input.publicKey);
  for (const target of TARGETS) {
    const path = input.paths.find((p) => target.match.test(p));
    if (!path) continue;
    const source = await input.read(path);
    if (source === null) continue;
    if (source.includes(input.scriptUrl)) return null; // already installed
    const at = source.search(target.anchor);
    if (at === -1) continue;
    const content = `${source.slice(0, at)}${tag}\n${source.slice(at)}`;
    return { path, content, where: target.where };
  }
  return null;
}
