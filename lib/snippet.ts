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
  return `<script defer src="${scriptUrl}" data-key="${publicKey}"></script>`;
}

interface Target {
  match: RegExp;
  where: string;
  /** Closing tag the snippet goes in front of. */
  anchor: RegExp;
}

const TARGETS: Target[] = [
  { match: /^(src\/)?app\/layout\.(tsx|jsx|js)$/, where: "Next.js app layout", anchor: /<\/body>/i },
  { match: /^(src\/)?pages\/_document\.(tsx|jsx|js)$/, where: "Next.js document", anchor: /<\/Head>/ },
  { match: /^index\.html$/, where: "index.html", anchor: /<\/head>/i },
  { match: /^(public|src)\/index\.html$/, where: "index.html", anchor: /<\/head>/i },
];

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
