import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/sessionToken";

const PUBLIC = [/^\/$/, /^\/login$/, /^\/api\/oauth\//, /^\/api\/collect$/, /^\/t\.js$/, /^\/(logo|icon)\.svg$/, /^\/(apple-icon|social-preview)\.png$/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  const session = await verifyToken<{ uid?: string }>(req.cookies.get(SESSION_COOKIE)?.value);
  if (session?.uid) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
