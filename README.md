# PackWise

Smart packing for every trip. PackWise builds **weather-aware packing lists** from curated templates, layers in **forecasts**, lets you **share trips** so co-travelers can see your list, and includes **Suitcase Snap** (AI suitcase scanning — Coming Soon, PackWise Pro) — all as an installable Progressive Web App.

## Features

- **Email/password + Google auth** — sign in via Supabase (guest mode available)
- **Trips** — destination, dates, trip type, traveler count
- **Packing lists** — curated weather-aware templates (regenerate anytime)
- **Weather-aware packing** — Open-Meteo daily highs/lows and rain chance for the trip window (geocodes with `name={city}` and optional `countryCode` filter, then exact `country_code` match; static climate averages beyond 16 days or when geocoding fails)
- **Shared trips** — invite links so co-travelers can view the packing list (view-only; live collaborative check-offs coming soon)
- **Suitcase Snap** — photo → vision model suggests missing items (Coming Soon; PackWise Pro via Stripe when billing is live)
- **Packing reminder emails** — daily cron emails owners of trips starting tomorrow (UTC) when packing is incomplete (opt out in Settings; Resend)
- **Duplicate trip** — clone a trip and its list for the next adventure
- **Dark mode** — system-aware theme toggle (persisted)
- **PWA** — installable on desktop and mobile after a production build

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase Auth + Postgres · Google Gemini (suitcase vision) · Stripe Checkout · Resend (packing reminders) · Open-Meteo (weather + city search) · `@ducanh2912/next-pwa`

## Environment variables

Copy the example file and fill in real values:

```bash
copy .env.local.example .env.local
```

| Variable | Required | Where used | Notes |
| -------- | -------- | ---------- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser + server + middleware | Supabase **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser + server + middleware | Supabase **anon** public key |
| `GEMINI_API_KEY` | Optional (suitcase scan) | Server only | [Google AI Studio](https://aistudio.google.com/apikey) — Suitcase Snap vision only (`gemini-2.5-flash`). Packing lists do **not** use Gemini. |
| `PACKWISE_PRO` | Optional | Server only | Set to `true` to force Pro for local testing (unlimited scans). Production Pro comes from `profiles.is_pro` (Stripe webhook). |
| `STRIPE_SECRET_KEY` | Optional (billing) | Server only | [Stripe API keys](https://dashboard.stripe.com/apikeys) — Checkout Session for Pro upgrade |
| `STRIPE_PRICE_ID` | Optional (billing) | Server only | Recurring Price id (`price_…`) for PackWise Pro |
| `STRIPE_WEBHOOK_SECRET` | Optional (billing) | Server only | Signing secret for `POST /api/stripe/webhook` (sets `profiles.is_pro`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | Browser | Only needed if you add Stripe.js client UI later |
| `NEXT_PUBLIC_APP_URL` | Optional | Server | Origin for Checkout / packing-reminder email links (defaults to `http://localhost:3000`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (cron, webhooks, test bootstrap) | Server only | Service role key — never expose to the client |
| `CRON_SECRET` | Yes (packing reminders) | Server only | Bearer token for `GET /api/cron/packing-reminders` (Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`) |
| `RESEND_API_KEY` | Yes (packing reminders) | Server only | [Resend API key](https://resend.com/api-keys) for packing reminder emails |
| `RESEND_FROM_EMAIL` | Optional | Server only | Verified sender, e.g. `PackWise <reminders@yourdomain.com>`. Defaults to Resend onboarding address |
| `NEXT_PUBLIC_DEBUG_WEATHER` | Optional | Browser | Set to `true` to show geocoded lat/lon under each weather day (local debug only) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Optional | Browser | Plausible site domain (e.g. `packwise.app`). Script loads only after cookie consent **Accept**. Without it, Accept still stores consent but analytics is a no-op. |

Never prefix Gemini, Stripe, Resend, cron, or service-role secrets with `NEXT_PUBLIC_` — they must stay server-only. Weather and city search use [Open-Meteo](https://open-meteo.com/) (no API key). Cookie consent uses `packwise_cookie_consent` (`accepted` / `declined`, 1-year max-age); Decline never loads Plausible.

### Vercel (Production + Preview)

In the [Vercel dashboard](https://vercel.com) → your project → **Settings** → **Environment Variables**, add each variable for **Production** and **Preview** (and Development if you use `vercel env pull`):

1. `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL  
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key  
3. `SUPABASE_SERVICE_ROLE_KEY` — service role (cron trip queries, Stripe webhook Pro updates)  
4. `CRON_SECRET` — long random string; Vercel Cron attaches it as `Authorization: Bearer …`  
5. `RESEND_API_KEY` — packing reminder emails  
6. `RESEND_FROM_EMAIL` — optional verified From address  
7. `GEMINI_API_KEY` — paste your real Gemini key (suitcase scan)  
8. `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` — when enabling billing  
9. `PACKWISE_PRO` — optional; `true` only for forced Pro in a given environment  
10. `NEXT_PUBLIC_APP_URL` — production origin (no trailing slash) for email / Checkout links  

Or with the CLI (interactive — run locally in your terminal):

```bash
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
# repeat for SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, RESEND_API_KEY,
# RESEND_FROM_EMAIL, GEMINI_API_KEY, STRIPE_*, NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env ls
```

Do not paste placeholder strings (`YOUR_KEY`, `your-anon-key`) into Production secrets — use real keys from each provider dashboard.

After changing env vars, **redeploy** so the new values are picked up.

Also set Supabase Auth URLs for production (Authentication → URL Configuration).
Use your real Vercel / custom domain from the Vercel dashboard (Project → Domains) — do not invent a hostname.

OAuth (Google) and email confirmation use `redirectTo` / `emailRedirectTo` pointing at `/auth/callback` (with optional `?next=` for guest claim). Password recovery lands on `/reset-password`. Allowlist origins plus callback paths:

- **Site URL**: `https://<your-production-domain>` (e.g. `https://packwise.app` if that is your custom domain)
- **Redirect URLs** (add each that applies):
  - `https://<your-production-domain>/auth/callback`
  - `https://<your-production-domain>/reset-password`
  - `https://<your-production-domain>/**` (covers callback query variants and guest claim)
  - Preview deploy (example — use your actual preview host):
    - `https://packwise2026-bndidqy68-nowaitqueue-7040s-projects.vercel.app/auth/callback`
    - `https://packwise2026-bndidqy68-nowaitqueue-7040s-projects.vercel.app/**`
  - Optional preview wildcard: `https://*-<your-vercel-team>.vercel.app/**`

If `NEXT_PUBLIC_APP_URL` is set in Vercel, it must be that same production origin (no trailing slash). A mismatched Site URL / allowlist still causes failed or wrong redirects.

## Supabase setup

### Auth

1. **Authentication** → **Providers** → enable **Email** (email + password). Disable magic-link / OTP email templates if you no longer want them.
2. **Authentication** → **Providers** → enable **Google**. Add your Google OAuth Client ID and Client Secret from Google Cloud Console (Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`).
3. **MVP: disable email confirmation** (this cannot be toggled from the PackWise app — use the Supabase Dashboard):
   - Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
   - **Authentication** → **Providers** → **Email**
   - Turn **Confirm email** / **Enable email confirmations** **OFF**
   - With confirmations off, `signUp` returns a session and the app navigates straight to the dashboard (or preserved `next`). With confirmations on, the app shows a check-email screen and does **not** treat the user as logged in.
4. **Authentication** → **URL Configuration**:
   - Local **Site URL**: `http://localhost:3000` (or `http://localhost:3001` if that port is what `npm run dev` uses)
   - **Redirect URLs** (local):
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/reset-password`
     - `http://localhost:3000/**`
     - If you use port 3001: the same three paths on `http://localhost:3001`


### Migrations (apply in order)

In the [SQL Editor](https://supabase.com/dashboard) (or `supabase db push` if using the CLI), run:

1. `supabase/migrations/20260719000000_create_trips.sql`
2. `supabase/migrations/20260719120000_create_packing_lists.sql`
3. `supabase/migrations/20260719130000_create_trip_sharing.sql`
4. `supabase/migrations/20260719140000_create_suitcase_scans_storage.sql`
5. `supabase/migrations/20260719150000_fix_trips_rls_grants.sql`
6. `supabase/migrations/20260719151000_fix_trips_select_policy.sql`
7. `supabase/migrations/20260719160000_create_trip_weather.sql`
8. `supabase/migrations/20260720100000_create_profiles.sql` — scan quotas + Pro flags
9. Apply remaining files in `supabase/migrations/` in chronological order (onboarding, notification prefs, RLS hardening, packing custom items, webhooks, etc.)

**Packing reminders** need at least:

- `supabase/migrations/20260722180000_add_notification_prefs.sql` — `profiles.packing_reminder_email` (default `true`) + push pref
- `supabase/migrations/20260723000000_fix_profile_update_policy.sql` — Settings can update prefs
- `supabase/migrations/20260726120000_create_reminder_log.sql` — idempotent send log (`reminder_log`)

If those columns/tables are missing in your project, the Settings toggle and/or cron will fail until you apply the migrations above.

### Packing reminder emails (Resend + Vercel Cron)

Daily job (`vercel.json`): `GET /api/cron/packing-reminders` at `0 9 * * *` (09:00 UTC). Path must **not** include the secret — auth is `Authorization: Bearer <CRON_SECRET>` (also accepts `x-cron-secret` for local tools).

Logic: trips with `start_date` = tomorrow (UTC), packing list not 100% complete, and `profiles.packing_reminder_email !== false`. Sends via Resend; claims a `reminder_log` row so each trip is emailed at most once per UTC day.

**Local dry-run** (no Resend send, no `reminder_log` claim). If Postgres (or another process) already owns port 3000, run Next on **3001**:

```bash
npx next dev -p 3001
# then:
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3001/api/cron/packing-reminders?dryRun=1"
```

Omit `dryRun=1` to send for real (requires `RESEND_API_KEY` + applied migrations). Users toggle the preference under **Settings → Notifications** (`packing_reminder_email`).

### Stripe billing (optional)

1. Create a Product + recurring Price in Stripe; set `STRIPE_PRICE_ID`.
2. Set `STRIPE_SECRET_KEY` (and optionally `NEXT_PUBLIC_APP_URL`).
3. Add a webhook endpoint to `https://your-domain/api/stripe/webhook` for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Paste the signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set so the webhook can update `profiles.is_pro`.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the marketing landing page. Use **Get started** / **Log in** for email/password or Google auth, then the dashboard.

If port **3000** is already taken (common when local Postgres uses it), start the app on **3001**: `npx next dev -p 3001`, and point Supabase Auth redirect URLs / `NEXT_PUBLIC_APP_URL` at that origin.

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Development server |
| `npm run build` | Production build (also generates PWA service worker into `public/`) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run test:user` | Create/refresh test user + write `TEST_USER_JWT` into `.env.local` |
| `npm run test:flow` | API smoke: create trip → packing generate → weather |
| `npm run test:e2e` | Playwright e2e (starts `next dev` with test login) |
| `npm run test:e2e:ui` | Playwright UI mode |

## Test auth bootstrap

Shared local auth for smoke scripts and Playwright:

```bash
# Requires SUPABASE_SERVICE_ROLE_KEY (+ URL / anon key) in .env.local
node scripts/create-test-user.mjs --write-env
# or: npm run test:user
```

That creates/looks up `test@packwise.com` (password `Test1234!` by default), mints a session via `signInWithPassword`, and upserts `TEST_USER_JWT`, `TEST_USER_REFRESH_TOKEN`, `TEST_USER_ID`, `E2E_TEST_USER_EMAIL`, and `E2E_TEST_USER_ID` in `.env.local` without clobbering other secrets.

Then:

| Command | Uses |
| ------- | ---- |
| `node scripts/test-flow.mjs` | Prefers `TEST_USER_JWT` as Bearer. Use `--mock-apis` to skip live Open-Meteo weather. Packing generate uses templates (no Gemini). |
| `./scripts/test-api.sh <trip-uuid>` | Prefers `TEST_USER_JWT` as Bearer |
| `npm run test:e2e` | `e2e/auth.setup.ts` injects SSR cookies from `TEST_USER_JWT` (falls back to `/api/test/login`) |

JWTs expire — re-run `create-test-user --write-env` if auth starts failing.

## End-to-end tests (Playwright)

PackWise uses Playwright against a local Next.js server.

1. Copy `.env.local.example` → `.env.local` and set at least:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; never commit)
2. Bootstrap auth: `node scripts/create-test-user.mjs --write-env`
3. Packing lists use curated templates (no Gemini). Weather and city search use Open-Meteo (no key). If the packing list is empty, the e2e test seeds items via `POST /api/test/seed-packing`.
4. First time only: `npx playwright install chromium`
5. Run: `npm run test:e2e`

The Playwright `webServer` starts Next on **`127.0.0.1:3333`** (override with `PLAYWRIGHT_PORT` / `PLAYWRIGHT_BASE_URL`) and sets `ENABLE_TEST_LOGIN=true`. Flow:

1. **setup** project (`e2e/auth.setup.ts`) — prefers `TEST_USER_JWT` cookies (`sb-<ref>-auth-token`); falls back to `GET /api/test/login` (service-role session mint) when no JWT
2. Create a Paris trip on `/dashboard/new-trip`
3. Assert packing list items, toggle a checkbox, assert progress updates

Without Supabase + test-user env vars, the e2e suite **skips** with a clear message rather than failing obscurely. Do **not** set `ENABLE_TEST_LOGIN=true` on production.

## Deploy to Vercel

1. Push the repo to GitHub (or connect the folder with `vercel`).
2. Import the project in Vercel (or run `vercel` / `vercel --prod` from a linked project).
3. Add the environment variables above for Production and Preview (including `CRON_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for packing reminders).
4. Apply Supabase migrations (including notification prefs + `reminder_log`) and update Auth redirect URLs for the deployed domain.
5. Confirm `vercel.json` registers cron `/api/cron/packing-reminders` at `0 9 * * *` (no secret in the path).
6. Redeploy after env or Auth URL changes.

## Progressive Web App (PWA)

PackWise uses [`@ducanh2912/next-pwa`](https://github.com/DuCanhGH/next-pwa). The service worker is generated on **production** builds into `public/` (`sw.js`, Workbox files) and is **disabled in development**.

- Manifest: `public/manifest.webmanifest`
- Icons: `public/icons/icon-192.png`, `public/icons/icon-512.png` (regenerate with `node scripts/generate-pwa-icons.mjs`)

**Install:** `npm run build && npm run start` (or deploy over HTTPS) → browser **Install app** / **Add to Home Screen**. Standalone start URL is `/dashboard`.

## Project structure

- `src/app/page.tsx` — marketing landing (`/`)
- `src/app/login` — email/password + Google sign-in (guest mode)
- `src/app/dashboard` — trips, packing, weather, invite, suitcase scan
- `src/app/api/weather` — weather forecast API route
- `src/lib/supabase/` — browser, server, and middleware clients
- `src/lib/weather.ts` · `src/lib/packing.ts` · `src/lib/pro.ts` · `src/lib/trips.ts`
- `src/middleware.ts` — session refresh; protects `/dashboard`; does not force `/` away from marketing
- `supabase/migrations/` — schema in chronological order
- `public/manifest.webmanifest` · `public/icons/` — PWA assets
