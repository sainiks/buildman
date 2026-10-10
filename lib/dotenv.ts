/** Minimal .env parser (single-line values; quotes and trailing comments handled). */
export function parseDotenv(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const rest = m[2];
    const quoted = rest.match(/^"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/) ?? rest.match(/^'([^']*)'\s*(?:#.*)?$/);
    let value: string;
    if (quoted) {
      value = rest.startsWith('"') ? quoted[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : quoted[1];
    } else {
      value = rest.replace(/\s+#.*$/, "").trim();
    }
    out[m[1]] = value;
  }
  return out;
}
