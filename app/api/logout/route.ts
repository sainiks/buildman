import { appUrl } from "@/lib/config";
import { SESSION_COOKIE, clearCookie } from "@/lib/sessionToken";

export async function POST(req: Request) {
  const res = new Response(null, { status: 303, headers: { Location: `${appUrl(req)}/login` } });
  res.headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
  return res;
}
