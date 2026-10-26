<p align="center"><img src="public/logo.svg" width="96" alt="Buildman logo"></p>

# Buildman

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml) ![License: MIT](https://img.shields.io/badge/license-MIT-blue)

*Build, and the rest is easy with Buildman.*

Sign in with GitHub, connect Vercel and Supabase once, then drop a project (a `.zip` or a folder, from a phone or a Mac). Buildman creates a GitHub repository named after the project, creates a Supabase database if the project needs one, deploys to Vercel, and gives you a personal dashboard of how each site is doing.

```
Browser ──► upload zip / folder
              │  (detect framework, database, .env; add tracking tag)
              ▼
   ┌──────────────────────────── Buildman server ────────────────────────────┐
   │  GitHub ── create repo ─► push files ─► commit                         │
   │  Supabase ── create project ─► wait healthy ─► run your SQL            │
   │  Vercel ── create project (repo linked, env vars set) ─► deploy        │
   └────────────────────────────────────────────────────────────────────────┘
              │                                   ▲
              ▼                                   │ beacon (no cookies, no IPs)
      Dashboard: visits, pages, referrers,   visitors of the deployed site
      countries, devices, events, plus Vercel deploys, Supabase API
      requests and GitHub activity
```

## How users connect their accounts (no tokens to find)

Users never create, copy or paste a token. Each service uses OAuth:

1. The user clicks **Continue with GitHub** (sign-in), or **Connect** either on the Connections page or inline while shipping (see below).
2. They are sent to the service, see its normal consent screen, and approve.
3. The service redirects back to Buildman with a one-time `code`.
4. Buildman's server exchanges the code for an access token and stores it **encrypted** (AES-256-GCM, key in `ENCRYPTION_KEY`) in Buildman's database. The browser never receives it.
5. From then on every action runs with *that user's* token, scoped to *their* GitHub, Vercel and Supabase accounts.

What *you*, the operator, do once per service is register Buildman as an app and put its client ID and secret in the server environment (below). That is the only token-like setup, and it is not per user.

| Service | What you register | Why it's different |
|---|---|---|
| GitHub | An **OAuth App** | Doubles as the sign-in method |
| Vercel | An **Integration** | Vercel's route for third-party apps to act on a user's account; the token is long-lived and may be tied to a team |
| Supabase | An **OAuth App** (organization settings) | Uses PKCE; access tokens are refreshed automatically |
| Netlify (optional) | An **OAuth App** (user settings) | Alternative host. Tokens don't expire. Netlify's API has no one-call GitHub link, so Buildman adds a read-only deploy key and a push webhook to the repo |

## Setup

### 1. Buildman's own database

Create a Supabase project just for Buildman, open its SQL editor and run [`supabase/schema.sql`](supabase/schema.sql). Row level security is on with no policies, so only the server (service-role key) can read these tables. Copy the project URL and the `service_role` key.

### 2. Register the three apps

Replace `<APP_URL>` with your deployment URL (`http://localhost:3000` locally).

**GitHub OAuth App**: GitHub → Settings → Developer settings → OAuth Apps → New.
Callback URL: `<APP_URL>/api/oauth/github/callback`. Buildman requests `repo read:user user:email`.

**Vercel Integration**: Vercel → Team Settings → Integrations → Developer → Create.
Redirect URL: `<APP_URL>/api/oauth/vercel/callback`. Grant read/write on **Projects**, **Deployments** and **Project Environment Variables**, read on **Teams** and **User**. Because Buildman sets environment variables that belong to the user (not to the integration), the *global* project env vars scope is the likely requirement; if env vars are rejected, check this first. Put the integration's slug (the last part of `vercel.com/integrations/<slug>`) in `VC_INTEGRATION_SLUG` (Vercel reserves the `VERCEL_` prefix, so these settings are `VC_INTEGRATION_SLUG`, `VC_CLIENT_ID` and `VC_CLIENT_SECRET`; the old `VERCEL_*` names still work locally).

**Supabase OAuth App**: Supabase → Organization settings → OAuth Apps → Add application.
Redirect URI: `<APP_URL>/api/oauth/supabase/callback`. Scopes are chosen when the app is created; enable the ones covering projects, database, organizations, analytics and API keys.

**Netlify OAuth App** (optional): Netlify → User settings → Applications → OAuth applications → New.
Redirect URI: `<APP_URL>/api/oauth/netlify/callback`. Put the client id and secret in `NETLIFY_CLIENT_ID` and `NETLIFY_CLIENT_SECRET`. Then run [`supabase/migrations/002_netlify.sql`](supabase/migrations/002_netlify.sql) once in Buildman's own Supabase project so projects can record which host they use. Netlify's documentation for the OAuth code exchange is thin, so treat this plugin as best-effort and test it with a real Netlify account.

### 3. Configure and run

```bash
cp .env.example .env.local                                             # fill it in; the file explains every value
npm install
npm run dev
```

Generate the two secrets:

```bash
openssl rand -base64 48                                                       # SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # ENCRYPTION_KEY
```

### Just-in-time connect

Vercel and Supabase are asked for only when the project in hand needs them: Vercel when deploying, Supabase when a database was detected and is switched on. On the review step Buildman shows a **Connect** button for each missing service. It opens the sign-in in a small pop-up (`/api/oauth/<id>/start?return=/connect-done?provider=<id>`), so the uploaded files stay in the page. The pop-up lands on `/connect-done` and closes itself; the page polls `/api/connections` and unlocks **Ship it** once the connection exists. If the browser blocks pop-ups the user is told to allow them.

The `return` value is checked against an allow-list of our own paths (`lib/returnTo.ts`: `/connect-done`, `/connections`, `/new`), signed into the short-lived `gm_oauth` cookie, and re-checked in the callback, so it can't be used as an open redirect. For Vercel, the `next` URL it returns is only followed if it is on `vercel.com`. Unverified: that visiting Vercel's `next` URL is what completes the install.

A provider whose variables are missing shows "isn't set up on this server yet" on the Connections page instead of failing, so you can enable them one at a time.

### 4. Deploy Buildman itself to Vercel

Vercel detects this Next.js app from `package.json`; no custom build command or `vercel.json` is needed. Import this repository into Vercel and keep the Root Directory as `.`. The committed `package-lock.json` makes Vercel use `npm ci` for reproducible installs.

Before the first production deployment:

1. Create a dedicated Supabase project for Buildman's own data. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor. If you plan to offer Netlify, also run [`supabase/migrations/002_netlify.sql`](supabase/migrations/002_netlify.sql). These are Buildman's tables, not the databases Buildman creates for users.
2. In Vercel → **Project → Settings → Environment Variables**, add the required production values below. Keep secrets server-only: do not prefix them with `NEXT_PUBLIC_`.
3. Set `APP_URL` to the canonical production origin, for example `https://buildman-eight.vercel.app`, with no trailing slash. Add the production callback URL shown below to each provider app registration. Preview deployments have different hostnames; use the production domain for OAuth callbacks unless you intentionally configure separate preview apps and callback URLs.
4. Deploy, then check the public landing page and sign-in. Provider cards show as unavailable until their optional credentials are configured.

Required for the app to run:

| Vercel variable | Value |
|---|---|
| `APP_URL` | Canonical production URL, with no trailing slash |
| `SESSION_SECRET` | Output of `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | Output of `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`; keep the same value permanently or stored tokens become unreadable |
| `GITMAN_SUPABASE_URL` | URL of Buildman's own Supabase project |
| `GITMAN_SUPABASE_SERVICE_KEY` | Service role key for that project; server only |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Buildman's GitHub OAuth App credentials; required for sign-in |

Add these provider credentials to enable the corresponding user connection:

| Provider | Vercel variables | Production callback URL |
|---|---|---|
| Vercel | `VC_INTEGRATION_SLUG`, `VC_CLIENT_ID`, `VC_CLIENT_SECRET` | `${APP_URL}/api/oauth/vercel/callback` |
| Supabase | `SUPABASE_OAUTH_CLIENT_ID`, `SUPABASE_OAUTH_CLIENT_SECRET` | `${APP_URL}/api/oauth/supabase/callback` |
| Netlify | `NETLIFY_CLIENT_ID`, `NETLIFY_CLIENT_SECRET` | `${APP_URL}/api/oauth/netlify/callback` |

`VERCEL_*` names are reserved by Vercel, so use the `VC_*` names above for Buildman's Vercel integration settings. `SUPABASE_REGION` is optional and defaults to `ap-south-1`. After changing production variables, redeploy so the functions receive the new values. Never commit `.env.local` or copy provider secrets into client-side variables.

Vercel functions use the route-level `maxDuration` settings in the pipeline handlers. If your Vercel plan does not allow the configured duration, raise the plan limit or lower those route values before relying on long provider provisioning operations.

## What happens when a user ships a project

1. **Read & detect (in the browser).** A zip is unpacked locally; a folder is read locally. Framework comes from `package.json`; a database is detected from `@supabase/*`, a `supabase/` folder, `SUPABASE_*` names in an example env file, or SQL schema files.
2. **Never uploaded:** `node_modules`, `.git`, build output, caches, `.DS_Store`, key files (`*.pem`, `*.key`, `id_rsa*`), and local `.env*` files (except `*.example`/`*.sample`/`*.template`). Values from `.env`, `.env.local` and `.env.production` are sent to Vercel as encrypted environment variables instead; values pointing at `localhost`, and `VERCEL_*`/`NODE_ENV`, are dropped.
3. **Tracking tag (optional, on by default).** One `<script>` line is added to `index.html`, the Next.js app layout, or `pages/_document`. If no safe place is found the project page shows the line to paste in.
4. **GitHub.** Repository created in the user's account, files pushed in size-bounded batches, one commit on the default branch. Name taken → `name-2`, `name-3`, and the user is told.
5. **Supabase.** Created while files upload so provisioning overlaps. Migrations in `supabase/migrations/*.sql` run in filename order (else the first of `supabase/schema.sql`, `schema.sql`, `db/schema.sql`, `database/schema.sql`, `sql/schema.sql`). `seed.sql` is not run. The database password is shown once and never stored.
6. **Vercel.** Project created with the repo linked and environment variables set (the framework's public Supabase pair, plus any other `SUPABASE_*` name the project declares; `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` only if declared). Then a production deployment, polled to completion.

The browser drives the steps and polling, and each API route is one short call, so nothing runs into serverless time or body-size limits (files over 3 MB are skipped with a note).

## The dashboard

- **Overview:** totals across all of the user's projects with change versus the previous period, a daily traffic chart, and one card per project with a sparkline.
- **Project page:** visitors, page views and events over 7/30/90 days, top pages, referrers, countries, devices and custom events.
- **Platform panels:** recent Vercel deployments, Supabase API request counts (REST, auth, storage, realtime) and GitHub activity. Each panel fails independently and says why, so a revoked Vercel connection doesn't blank the page.

### Traffic tracking and privacy

The tag loads `/t.js` from Buildman, which posts to `/api/collect`. By design:

- **No cookies, no stored IPs.** A visitor is a hash of IP + user agent + project + the current UTC date, with a secret salt, so it cannot be linked across days. A returning person counts once per day.
- No cookies, no stored IPs. Generated tags set `data-dnt="ignore"` so visits from browsers sending Do Not Track are still counted; delete that attribute from the tag to honor Do Not Track instead. Ignores common bots; rate-limited per IP and project.
- Single-page apps are handled (route changes count). Outbound link clicks are recorded as `outbound:<host>`. Custom events: `window.buildman.track("signup")` or `data-buildman-event="buy"` on an element.
- The project key in the tag (`pk_…`) is public by nature, so anyone who copies it can send fake events to that project. This is the same trade-off as any client-side analytics.

## Adding another service (plugin)

A service is one file implementing `Provider` from [`lib/providers/types.ts`](lib/providers/types.ts): `authorizeUrl`, `exchange` (code → tokens), optionally `refresh`, plus its env var names. Add it to the `ProviderId` union and to the `providers` map in `lib/providers/index.ts`. The OAuth routes, encrypted token storage, refresh handling and the Connections page pick it up with no other change. What the service *does* (for example Netlify deploys) is then new code in the pipeline.

## Security notes

- Provider tokens are encrypted at rest and decrypted only on the server per request. Changing `ENCRYPTION_KEY` invalidates them (users reconnect).
- OAuth uses a random `state` bound to a signed, HttpOnly, 10-minute cookie, PKCE for Supabase, and rejects a callback whose cookie was issued for a different provider.
- Every project route checks the project belongs to the signed-in user (a foreign id returns 404), and migrations only ever run against the database recorded for that project.
- Sessions are signed JWTs (HS256), 30 days, `HttpOnly; SameSite=Lax; Secure` in production.
- **GitHub scope.** Creating private repositories with an OAuth App requires the `repo` scope, which also lets the token read the user's other private repositories. Buildman only uses it to create the new repo and push, but the consent screen will say "repo". Moving to a GitHub App with fine-grained permissions is the hardening step if you open this to the public.

## Known limits

- **Not yet exercised against live accounts.** The code is typechecked and built, the SQL aggregates run against a real Postgres engine, and the sign-in, session, OAuth-redirect, PKCE and collector paths pass an automated smoke test (47 checks). The calls to GitHub, Vercel and Supabase themselves were written from their public docs and have not been run end to end with real credentials.
- **Unconfirmed API details:** the Supabase `usage.api-counts` response shape (that panel shows an error if it differs), the Supabase create-project request fields, whether Vercel's install URL echoes `state` (the callback is safe either way: the signed cookie is the proof of origin), and the exact Vercel scope names. Supabase's access-token lifetime is undocumented, so Buildman refreshes early.
- The Vercel GitHub app must be installed on the user's GitHub account, or Vercel can't link the repo (the error says so).
- A failed run isn't resumable. It leaves a project in "creating" or "failed" state that can be removed from the dashboard (removing it does not delete the repo, Vercel project or database).
- The collector's rate limiter is in memory per server instance.
- Monorepos, or apps needing a Vercel root directory other than `/`, aren't configured automatically.


## Pages and motion

- `/` is a public landing page (signed-in visitors see an "Open your dashboard" button). `/login` shares its look. The signed-in app lives under `/dashboard`, `/new`, `/connections` and `/projects/<id>`.
- The landing page is a title sequence graded in teal and tungsten. Its hero loop (`components/landing/Stage.tsx`) is pure SVG and CSS: files drop into a frame, get scanned, and three beams light up the repo, the live site and the database. Below it, headings pull into focus as they scroll in, hairlines draw themselves, and the sample report draws its own lines. The only client script is `components/landing/LandingFX.tsx` (scroll reveals, a slow drift on the hero copy, and a cursor spotlight on rows).
- The app uses the same ideas in small doses: figures count up, charts draw left to right, finished steps bloom once, project cards sweep a highlight on hover.
- Everything respects `prefers-reduced-motion`: with it on, the page shows its finished frame and nothing moves.
- The creator credits in the footer come from `CREATOR` in `lib/brand.ts`.

## References

- GitHub OAuth web flow: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Vercel integrations and token exchange: https://vercel.com/docs/integrations/create-integration/vercel-api-integrations
- Supabase OAuth for the Management API: https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration
- Supabase Management API: https://supabase.com/docs/reference/api
- Vercel REST API: https://vercel.com/docs/rest-api
- Vercel function limits: https://vercel.com/docs/functions/limitations

## Publishing this repository

```bash
git init -b main
git add .
git commit -m "Initial commit"
gh repo create buildman --public --source=. --push             # or create it on github.com and add the remote
```

`.gitignore` already excludes `.env*` (only `.env.example` is committed), `node_modules`, `.next` and zip files, so no secret is pushed. CI (`.github/workflows/ci.yml`) type-checks and builds on every push and pull request. Then import the repository on Vercel and add the variables from `.env.example` (see step 4 above).

Optional: in the repo's **Settings → General → Social preview**, upload `public/social-preview.png` (1280×640) so links to the repository show the Buildman card.

Created by [Kunal Saini](https://www.linkedin.com/in/kunal-saini-b392a0167/) ([@sainiks](https://github.com/sainiks)). MIT licensed.
