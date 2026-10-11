import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db, ok, type UserRow } from "./db";
import { HttpError } from "./env";
import { SESSION_COOKIE, SESSION_DAYS, cookieString, signToken, verifyToken } from "./sessionToken";

export async function createSessionCookie(userId: string): Promise<string> {
  const token = await signToken({ uid: userId }, SESSION_DAYS * 86400);
  return cookieString(SESSION_COOKIE, token, SESSION_DAYS * 86400);
}

export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const payload = await verifyToken<{ uid?: string }>(jar.get(SESSION_COOKIE)?.value);
  return typeof payload?.uid === "string" ? payload.uid : null;
}

/** For pages: returns the signed-in user or redirects to /login. */
// cache(): the layout and the page both call this in one request; run the query only once.
export const requireUserPage = cache(async (): Promise<UserRow> => {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const row = ok(await db().from("users").select("*").eq("id", uid).maybeSingle(), "Load user");
  if (!row) redirect("/login");
  return row as UserRow;
});

/**
 * Signed-in user id for pages that only need the id. No database call, so the page can start its own
 * queries immediately while the layout checks the user row in parallel. The layout still rejects
 * deleted users, so a stale cookie never renders a page.
 */
export const requireUidPage = cache(async (): Promise<string> => {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  return uid;
});

/** For API routes: returns the user id or throws 401. */
export async function requireUserId(): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new HttpError(401, "Not signed in.");
  return uid;
}
