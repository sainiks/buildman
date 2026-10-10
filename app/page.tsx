import type { Metadata } from "next";
import Backdrop from "@/components/landing/Backdrop";
import HeroTiles from "@/components/landing/HeroTiles";
import HeroDemo from "@/components/landing/HeroDemo";
import LandingFX from "@/components/landing/LandingFX";
import ReportMock from "@/components/landing/ReportMock";
import Marquee from "@/components/landing/Marquee";
import Privacy from "@/components/landing/Privacy";
import Reel from "@/components/landing/Reel";
import { SceneDrop, SceneShip, SceneSignIn } from "@/components/landing/Scenes";
import { APP_NAME, APP_TAGLINE, CREATOR } from "@/lib/brand";
import { currentUserId } from "@/lib/session";
import "./landing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: APP_TAGLINE },
  description:
    "Upload a zip or a folder. Buildman creates the GitHub repository, deploys it on Vercel, sets up a Supabase database when your project needs one, and reports who visits.",
};

const GITHUB_MARK = (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);

const STEPS = [
  { title: "Sign in with GitHub", body: "One click. Nothing to copy or paste.", scene: <SceneSignIn /> },
  { title: "Drop your project", body: "A zip or a folder. Buildman reads what it is.", scene: <SceneDrop /> },
  { title: "Connect only what it needs", body: "Asked at that moment, in a small window.", scene: <SceneShip /> },
];

const FAQ = [
  {
    q: "Do I need to create any tokens or API keys?",
    a: "No. You sign in with GitHub, and connect Vercel and Supabase through their own approval screens. Buildman receives and stores the access it needs, encrypted.",
  },
  {
    q: "What happens if my project has no database?",
    a: "Buildman skips Supabase and doesn't ask you to connect it. You get the repository and the live site.",
  },
  {
    q: "Which projects work?",
    a: "Static sites and Node projects. Buildman detects frameworks such as Next.js, Vite, SvelteKit, Astro, Nuxt, Remix and Gatsby, and tells Vercel how to build them.",
  },
  {
    q: "Can I upload from my phone?",
    a: "Yes. Pick a zip file in any mobile browser. Uploading a whole folder needs a desktop browser.",
  },
  {
    q: "Is there a file size limit?",
    a: "Individual files over 3 MB can't be pushed to the repository. Buildman uploads in batches, so large projects with many small files are fine.",
  },
  {
    q: "How does the traffic report work?",
    a: "Buildman adds a small script tag to your site's HTML. It sends page views and any events you define to Buildman, and the report is built from those plus data from Vercel, Supabase and GitHub.",
  },
];

export default async function Landing() {
  const signedIn = Boolean(await currentUserId());
  const cta = signedIn
    ? { href: "/dashboard", label: "Open your dashboard" }
    : { href: "/api/oauth/github/start", label: "Continue with GitHub" };
  const words = APP_TAGLINE.split(" ");

  return (
    <div className="lp">
      <Backdrop />
      <LandingFX />

      <header className="lp-nav">
        <div className="lp-nav-in">
          <a href="#top" className="lp-brand"><i aria-hidden />{APP_NAME}</a>
          <nav className="lp-links" aria-label="Page">
            <a href="#how">How it works</a>
            <a href="#get">What you get</a>
            <a href="#report">Report</a>
            <a href="#privacy">Privacy</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="lp-btn primary" href={cta.href}>{signedIn ? "Dashboard" : "Sign in"}</a>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-copy">
            <HeroTiles />
            <h1 className="lp-title" aria-label={APP_TAGLINE}>
              {words.map((w, i) => (
                <span key={i} aria-hidden>
                  <span className="w"><span style={{ ["--i" as string]: i }}>{w}</span></span>{" "}
                </span>
              ))}
            </h1>
            <p className="lp-lede">
              Drop a zip or a folder from your phone or Mac. {APP_NAME} does the git, the deploy and the database. You keep the credit.
            </p>
            <div className="lp-cta">
              <a className="lp-btn primary" href={cta.href}>
                {!signedIn && GITHUB_MARK}
                {cta.label}
              </a>
              <a className="lp-btn ghost" href={CREATOR.githubUrl} target="_blank" rel="noopener noreferrer">Peek at the maker (legally) ↗</a>
              <span className="lp-fine">No tokens to copy or paste.</span>
            </div>
          </div>
        </section>

        <section className="lp-demo" id="demo">
          <div className="lp-wrap">
            <h2 className="lp-h2" data-focus>Press the button. Watch it happen.</h2>
            <HeroDemo />
          </div>
        </section>

        <Marquee />

        <section className="lp-sec" id="how">
          <div className="lp-wrap">
            <h2 className="lp-h2" data-focus>From a folder on your device to a live site, in three steps.</h2>
            <ol className="lp-scenes">
              {STEPS.map((st, i) => (
                <li key={st.title}>
                  {st.scene}
                  <div className="cap">
                    <span className="n">Step {i + 1}</span>
                    <h3>{st.title}</h3>
                    <p>{st.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-sec" id="get">
          <div className="lp-wrap">
            <h2 className="lp-h2" data-focus>Four things appear. You touch none of them.</h2>
            <Reel />
          </div>
        </section>

        <section className="lp-sec" id="report">
          <div className="lp-wrap lp-report">
            <div>
              <h2 className="lp-h2" data-focus>See who visits what you ship.</h2>
              <p className="lp-p" data-focus>
                Every project gets its own page in your dashboard. It starts filling in as soon as the site has its first visitor.
              </p>
              
            </div>
            <ReportMock />
          </div>
        </section>

        <section className="lp-sec" id="privacy">
          <div className="lp-wrap">
            <h2 className="lp-h2" data-focus>Your accounts, handled with care.</h2>
            <Privacy />
          </div>
        </section>

        <section className="lp-sec" id="faq">
          <div className="lp-wrap">
            <h2 className="lp-h2" data-focus>Questions people ask first.</h2>
            <div className="lp-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <div className="ans"><div><p>{f.a}</p></div></div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-end">
          <div className="lp-wrap">
            <h2 className="lp-h2" data-focus>Your files are ready. Drop them in.</h2>
            <div className="lp-cta" style={{ opacity: 1, animation: "none", marginTop: 36 }}>
              <a className="lp-btn primary" href={cta.href}>
                {!signedIn && GITHUB_MARK}
                {cta.label}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-foot-in">
          <span className="by">
            Built by <a href={CREATOR.linkedinUrl} target="_blank" rel="noopener noreferrer">{CREATOR.name}</a>
          </span>
          <nav aria-label="Creator">
            <a href={CREATOR.githubUrl} target="_blank" rel="noopener noreferrer">GitHub @{CREATOR.github}</a>
            <a href={CREATOR.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </nav>
          <span>{APP_NAME}</span>
        </div>
      </footer>
    </div>
  );
}
