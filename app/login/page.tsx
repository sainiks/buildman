import Link from "next/link";
import { redirect } from "next/navigation";
import Backdrop from "@/components/landing/Backdrop";
import { APP_NAME } from "@/lib/brand";
import { currentUserId } from "@/lib/session";
import "../landing.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUserId()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <div className="lp">
      <Backdrop />
      <header className="lp-nav">
        <div className="lp-nav-in">
          <Link href="/" className="lp-brand"><i aria-hidden />{APP_NAME}</Link>
        </div>
      </header>
      <main className="lp-signin">
        <div className="lp-signin-card">
          <h1>Sign in to {APP_NAME}</h1>
          <p className="sub">Use your GitHub account. It is how {APP_NAME} creates repositories for you.</p>
          {error && <p className="lp-err" role="alert">{error}</p>}
          <a className="lp-btn primary" href="/api/oauth/github/start">Continue with GitHub</a>
          <p className="note">You connect Vercel and Supabase later, only when a project needs them.</p>
        </div>
      </main>
    </div>
  );
}
