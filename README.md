# PackWise

Smart packing for every trip. PackWise builds **weather-aware packing lists** from curated templates, layers in **forecasts**, lets you **share trips** so co-travelers can see your list, and **scan your suitcase** (3 free scans/month, unlimited on Pro) — all as an installable Progressive Web App.

## Features

- **Magic-link auth** — sign in with email via Supabase (no password)
- **Trips** — destination, dates, trip type, traveler count
- **Packing lists** — curated weather-aware templates (regenerate anytime)
- **Weather-aware packing** — Open-Meteo daily highs/lows and rain chance for the trip window (geocodes with `name={city}` and optional `countryCode` filter, then exact `country_code` match; static climate averages beyond 16 days or when geocoding fails)
- **Shared trips** — invite links so co-travelers can view the packing list (view-only; live collaborative check-offs coming soon)
- **Scan My Suitcase** — photo → vision model suggests missing items (3 free scans/month; Pro unlimited via Stripe)
- **Duplicate trip** — clone a trip and its list for the next adventure
- **Dark mode** — system-aware theme toggle (persisted)
- **PWA** — installable on desktop and mobile after a production build

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase Auth + Postgres · Google Gemini (suitcase vision) · Stripe Checkout · Open-Meteo (weather + city search) · `@ducanh2912/next-pwa`

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
| `NEXT_PUBLIC_APP_URL` | Optional | Server | Origin for Checkout success/cancel URLs (defaults to `http://localhost:3000`) |
| `NEXT_PUBLIC_DEBUG_WEATHER` | Optional | Browser | Set to `true` to show geocoded lat/lon under each weather day (local debug only) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Optional | Browser | Plausible site domain (e.g. `packwise.app`). Script loads only after cookie consent **Accept**. Without it, Accept still stores consent but analytics is a no-op. |

Never prefix Gemini or Stripe secret keys with `NEXT_PUBLIC_` — they must stay server-only. Weather and city search use [Open-Meteo](https://open-meteo.com/) (no API key). Cookie consent uses `packwise_cookie_consent` (`accepted` / `declined`, 1-year max-age); Decline never loads Plausible.

### Vercel (Production + Preview)

In the [Vercel dashboard](https://vercel.com) → your project → **Settings** → **Environment Variables**, add each variable for **Production** and **Preview** (and Development if you use `vercel env pull`):

1. `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL  
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key  
3. `GEMINI_API_KEY` — paste your real Gemini key (suitcase scan)  
4. `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` — when enabling billing  
5. `PACKWISE_PRO` — optional; `true` only for forced Pro in a given environment  

Or with the CLI (interactive — run locally in your terminal):

```bash
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
# repeat for GEMINI_API_KEY, STRIPE_*, NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env ls
```

Do not paste placeholder strings (`YOUR_KEY`, `your-anon-key`) into Production secrets — use real keys from each provider dashboard.

After changing env vars, **redeploy** so the new values are picked up.

Also set Supabase Auth URLs for production:

- **Site URL**: `https://your-app.vercel.app` (or custom domain)
- **Redirect URLs**: `https://your-app.vercel.app/auth/callback` (and Preview URLs if you use them)

## Supabase setup

### Auth

1. **Authentication** → **Providers** → enable **Email** / magic link (OTP).
2. **Authentication** → **URL Configuration**:
   - Local **Site URL**: `http://localhost:3000` (or `http://localhost:3001` if that port is what `npm run dev` uses)
   - **Redirect URLs**: `http://localhost:3000/auth/callback` and, if you use another port, `http://localhost:3001/auth/callback` (plus `/reset-password` for password reset)


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

Open [http://localhost:3000](http://localhost:3000) for the marketing landing page. Use **Get started** / **Log in** for magic-link auth, then the dashboard.

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

That creates/looks up `test@packwise.com` (password `test123` by default), mints a session, and upserts `TEST_USER_JWT`, `TEST_USER_REFRESH_TOKEN`, `TEST_USER_ID`, `E2E_TEST_USER_EMAIL`, and `E2E_TEST_USER_ID` in `.env.local` without clobbering other secrets.

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

1. **setup** project (`e2e/auth.setup.ts`) — prefers `TEST_USER_JWT` cookies (`sb-<ref>-auth-token`); falls back to `GET /api/test/login` (service-role magic link) when no JWT
2. Create a Paris trip on `/dashboard/new-trip`
3. Assert packing list items, toggle a checkbox, assert progress updates

Without Supabase + test-user env vars, the e2e suite **skips** with a clear message rather than failing obscurely. Do **not** set `ENABLE_TEST_LOGIN=true` on production.

## Deploy to Vercel

1. Push the repo to GitHub (or connect the folder with `vercel`).
2. Import the project in Vercel (or run `vercel` / `vercel --prod` from a linked project).
3. Add the environment variables above for Production and Preview.
4. Apply Supabase migrations and update Auth redirect URLs for the deployed domain.
5. Redeploy after env or Auth URL changes.

## Progressive Web App (PWA)

PackWise uses [`@ducanh2912/next-pwa`](https://github.com/DuCanhGH/next-pwa). The service worker is generated on **production** builds into `public/` (`sw.js`, Workbox files) and is **disabled in development**.

- Manifest: `public/manifest.webmanifest`
- Icons: `public/icons/icon-192.png`, `public/icons/icon-512.png` (regenerate with `node scripts/generate-pwa-icons.mjs`)

**Install:** `npm run build && npm run start` (or deploy over HTTPS) → browser **Install app** / **Add to Home Screen**. Standalone start URL is `/dashboard`.

## Project structure

- `src/app/page.tsx` — marketing landing (`/`)
- `src/app/login` — magic-link sign-in
- `src/app/dashboard` — trips, packing, weather, invite, suitcase scan
- `src/app/api/weather` — weather forecast API route
- `src/lib/supabase/` — browser, server, and middleware clients
- `src/lib/weather.ts` · `src/lib/packing.ts` · `src/lib/pro.ts` · `src/lib/trips.ts`
- `src/middleware.ts` — session refresh; protects `/dashboard`; does not force `/` away from marketing
- `supabase/migrations/` — schema in chronological order
- `public/manifest.webmanifest` · `public/icons/` — PWA assets
