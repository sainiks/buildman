import Link from "next/link";
import Nav from "@/components/Nav";
import { APP_NAME } from "@/lib/brand";
import { requireUserPage } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage();
  return (
    <>
      <header className="bar">
        <div className="bar-in">
          <Link href="/" className="logo">{APP_NAME}</Link>
          <Nav />
          <div className="who">
            {user.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" width={28} height={28} />
            )}
            <form action="/api/logout" method="post">
              <button type="submit" className="linkish">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
