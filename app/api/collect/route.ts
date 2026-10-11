import { createHash } from "node:crypto";
import { db } from "@/lib/db";

// Public endpoint hit by /t.js from visitors' browsers. It stores no cookies and no IPs: the
// visitor id is a hash of ip + user agent + project + today's date, so it can't be linked across days.

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Expose-Headers": "X-Buildman",
};

const KEY_RE = /^pk_[a-z0-9]{24}$/;
const BOT_RE = /bot|crawl|spider|slurp|headless|preview|lighthouse|monitor|curl|wget|python-requests/i;

const keyCache = new Map<string, { id: string | null; exp: number }>();
const buckets = new Map<string, { n: number; reset: number }>();

async function projectIdFor(key: string): Promise<string | null> {
  const hit = keyCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.id;
  const { data, error } = await db().from("projects").select("id").eq("public_key", key).maybeSingle();
  if (error) {
    console.error("[collect] project lookup failed:", error.message);
    return null; // don't cache a failure
  }
  const id = (data as { id: string } | null)?.id ?? null;
  if (keyCache.size > 2000) keyCache.clear();
  keyCache.set(key, { id, exp: Date.now() + 60_000 });
  return id;
}

function limited(bucket: string): boolean {
  const now = Date.now();
  const b = buckets.get(bucket);
  if (!b || b.reset < now) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(bucket, { n: 1, reset: now + 60_000 });
    return false;
  }
  b.n += 1;
  return b.n > 300; // per ip + project, per minute, per server instance
}

const clip = (v: unknown, max: number): string | null =>
  typeof v === "string" && v ? v.slice(0, max) : null;

function device(ua: string, width: number | null): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return width && width >= 768 ? "tablet" : "mobile";
  return "desktop";
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  // The X-Buildman header says why a hit was or wasn't stored; t.js shows it in ?buildman_debug=1 mode.
  const quiet = (reason = "skipped") => new Response(null, { status: 204, headers: { ...CORS, "X-Buildman": reason } });
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (BOT_RE.test(ua)) return quiet("bot-user-agent");

    const body = JSON.parse((await req.text()).slice(0, 4000)) as Record<string, unknown>;
    const key = typeof body.k === "string" ? body.k : "";
    if (!KEY_RE.test(key)) return quiet("bad-key-format");

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "0";
    if (limited(`${key}:${ip}`)) return quiet("rate-limited");

    const projectId = await projectIdFor(key);
    if (!projectId) return quiet("unknown-project-key");

    const type = body.t === "event" ? "event" : "pageview";
    const name = type === "event" ? clip(body.n, 60)?.replace(/[^\w:. -]/g, "") || null : null;
    if (type === "event" && !name) return quiet("empty-event-name");

    const path = (clip(body.p, 200) ?? "/").split(/[?#]/)[0] || "/";
    const pageHost = clip(body.h, 200)?.toLowerCase() ?? null;
    let referrer: string | null = null;
    try {
      const host = body.r ? new URL(String(body.r)).hostname.replace(/^www\./, "").toLowerCase() : null;
      referrer = host && host !== pageHost?.replace(/^www\./, "") ? host.slice(0, 120) : null;
    } catch {
      referrer = null;
    }

    const day = new Date().toISOString().slice(0, 10);
    const salt = createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}:${day}`).digest("hex");
    const visitor = createHash("sha256").update(`${salt}:${key}:${ip}:${ua}`).digest("hex").slice(0, 16);

    const width = typeof body.w === "number" ? body.w : null;
    const country = (req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? "").toUpperCase();

    const { error } = await db().from("events").insert({
      project_id: projectId,
      type,
      name,
      path: type === "pageview" ? path : null,
      referrer: type === "pageview" ? referrer : null,
      country: /^[A-Z]{2}$/.test(country) ? country : null,
      device: device(ua, width),
      visitor,
    });
    if (error) {
      console.error("[collect] insert failed:", error.message);
      return quiet("database-error");
    }
    return quiet("counted");
  } catch (e) {
    console.error("[collect] error:", e instanceof Error ? e.message : e);
    // Never surface errors to a visitor's browser.
  }
  return quiet();
}
