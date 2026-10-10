// Edge-safe (jose only): used by middleware as well as server code.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "gm_session";
export const OAUTH_COOKIE = "gm_oauth";
export const SESSION_DAYS = 30;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is missing or too short (use at least 32 random characters).");
  return new TextEncoder().encode(s);
}

export async function signToken(payload: Record<string, unknown>, ttlSeconds: number): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret());
}

export async function verifyToken<T extends Record<string, unknown>>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload as T;
  } catch {
    return null;
  }
}

export function cookieString(name: string, value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // Lax (not Strict) so the cookie survives the redirect back from GitHub/Vercel/Supabase.
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export const clearCookie = (name: string) => cookieString(name, "", 0);
