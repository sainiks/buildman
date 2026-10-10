import { cookies } from "next/headers";
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
export async function requireUserPage(): Promise<UserRow> {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const row = ok(await db().from("users").select("*").eq("id", uid).maybeSingle(), "Load user");
  if (!row) redirect("/login");
  return row as UserRow;
}

/** For API routes: returns the user id or throws 401. */
export async function requireUserId(): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new HttpError(401, "Not signed in.");
  return uid;
}
