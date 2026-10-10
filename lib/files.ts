// Browser-only: turns a dropped/picked zip or folder into a clean list of project files.
import JSZip from "jszip";

export interface Entry {
  /** Repo-relative path, forward slashes. */
  path: string;
  size: number;
  exec: boolean;
  /** Local .env-style file: never pushed, but its values are imported into Vercel. */
  secret: boolean;
  read: () => Promise<Uint8Array>;
}

export interface Ingested {
  name: string;
  entries: Entry[];
  ignoredCount: number;
}

export interface PathedFile {
  file: File;
  path: string;
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".vercel",
  ".turbo",
  ".cache",
  ".venv",
  "__pycache__",
  "__MACOSX",
  ".idea",
]);
const IGNORED_FILES = new Set([".DS_Store", "Thumbs.db"]);
const ENV_EXAMPLE = /\.(example|sample|template|dist)$/;
const KEY_FILE = /\.(pem|key|p12|pfx)$|^id_(rsa|ed25519|ecdsa)/;

export const isIgnoredDir = (name: string) => IGNORED_DIRS.has(name);

type Kind = "keep" | "secret" | "ignore";

function classify(path: string): Kind {
  const parts = path.split("/");
  if (parts.slice(0, -1).some((p) => IGNORED_DIRS.has(p))) return "ignore";
  const base = parts[parts.length - 1];
  if (IGNORED_FILES.has(base) || base.startsWith("._") || KEY_FILE.test(base)) return "ignore";
  if (base.startsWith(".env") && !ENV_EXAMPLE.test(base)) return "secret";
  return "keep";
}

/** If every file sits under one top-level folder (typical zip), drop that folder. */
function stripCommonRoot<T extends { path: string }>(items: T[]): { items: T[]; root: string | null } {
  if (items.length === 0) return { items, root: null };
  const first = items[0].path.split("/")[0];
  const shared = items.every((i) => i.path.includes("/") && i.path.split("/")[0] === first);
  if (!shared || ["src", "app", "public", "pages"].includes(first)) return { items, root: null };
  return { items: items.map((i) => ({ ...i, path: i.path.slice(first.length + 1) })), root: first };
}

function finish(name: string, raw: Omit<Entry, "secret">[]): Ingested {
  const usable = raw.filter((r) => classify(r.path) !== "ignore");
  const ignoredCount = raw.length - usable.length;
  const { items, root } = stripCommonRoot(usable);
  const entries: Entry[] = items.map((item) => ({ ...item, secret: classify(item.path) === "secret" }));
  return { name: root ?? name, entries, ignoredCount };
}

export async function ingestZip(file: File): Promise<Ingested> {
  const zip = await JSZip.loadAsync(file);
  const raw: Omit<Entry, "secret">[] = [];
  zip.forEach((relativePath, obj) => {
    if (obj.dir) return;
    const mode = obj.unixPermissions;
    if (typeof mode === "number" && (mode & 0o170000) === 0o120000) return; // symlink
    const path = relativePath.replace(/^\.?\/+/, "");
    raw.push({
      path,
      size: 0,
      exec: typeof mode === "number" && (mode & 0o111) !== 0,
      read: () => obj.async("uint8array"),
    });
  });
  const result = finish(file.name.replace(/\.zip$/i, ""), raw);
  // JSZip doesn't expose uncompressed sizes publicly, so measure once.
  await Promise.all(
    result.entries.map(async (e) => {
      const bytes = await e.read();
      e.size = bytes.byteLength;
    }),
  );
  return result;
}

export function ingestFiles(files: PathedFile[]): Ingested {
  const topFolder = files[0]?.path.split("/")[0] ?? "project";
  const raw = files.map(({ file, path }) => ({
    path,
    size: file.size,
    exec: /\.sh$/.test(path),
    read: async () => new Uint8Array(await file.arrayBuffer()),
  }));
  // Paths from a picked/dropped folder start with that folder's name; finish() strips it.
  return finish(topFolder, raw);
}

// --- dropped folders (drag & drop on Mac) -----------------------------------------------------

function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all);
        else {
          all.push(...batch);
          next();
        }
      }, reject);
    next();
  });
}

async function walk(entry: FileSystemEntry, out: PathedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    out.push({ file, path: entry.fullPath.replace(/^\//, "") });
    return;
  }
  for (const child of await readAll((entry as FileSystemDirectoryEntry).createReader())) {
    if (child.isDirectory && IGNORED_DIRS.has(child.name)) continue; // don't crawl node_modules etc.
    await walk(child, out);
  }
}

/** Reads a drop: a single .zip, or a folder tree. Returns what was found. */
export async function readDrop(dt: DataTransfer): Promise<{ zip?: File; files?: PathedFile[] }> {
  const items = [...dt.items].filter((i) => i.kind === "file");
  const entries = items.map((i) => i.webkitGetAsEntry()).filter((e): e is FileSystemEntry => e !== null);
  const first = entries[0];
  if (!first) return {};
  if (first.isFile) {
    const file = items[0].getAsFile();
    return file && /\.zip$/i.test(file.name) ? { zip: file } : {};
  }
  const out: PathedFile[] = [];
  for (const e of entries) await walk(e, out);
  return { files: out };
}

// --- helpers used by the pipeline -----------------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Returns the decoded string if the bytes are valid UTF-8 text (no NULs), else null. */
export function decodeText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
