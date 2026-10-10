/** GitHub and Vercel both accept lowercase letters, digits, ".", "_" and "-". */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\.zip$/i, "")
    .replace(/\s*\(\d+\)$/, "") // "my-app (1)" from duplicate downloads
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 80);
}
