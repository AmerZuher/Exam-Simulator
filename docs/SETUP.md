# Setup guide

How to run ExamPro locally and connect it to your own Supabase project.

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier is enough)
- (Optional) A Google Cloud project, if you want Google sign-in

## 1. Install dependencies

```bash
git clone https://github.com/AmerZuher/Exam-Simulator.git
cd Exam-Simulator
npm install
```

## 2. Create a Supabase project

1. [supabase.com](https://supabase.com) → **New Project**
2. Pick a name, database password, and region
3. Wait for it to provision (~2 minutes)
4. **Settings → API** → copy the **Project URL** and **anon public key**

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

`.env` is gitignored — never commit it.

## 4. Create the database schema

Open **Supabase → SQL Editor**, paste in
[`migrations/000_fresh_install.sql`](../migrations/000_fresh_install.sql),
and run it. That's the whole step — one script creates every table ExamPro
needs (profiles, exam groups, exams, questions, spaced-repetition state,
exam attempts, activity history) with Row-Level Security already configured,
scoped to `auth.uid()`.

The rest of the [`migrations/`](../migrations) folder isn't part of new
setup — it's only for upgrading an existing database that already has real
data in it. See [migrations/README.md](../migrations/README.md) if that's
your situation; otherwise you can ignore it.

## 5. Authentication

Email/password is enabled by default in Supabase — nothing to configure.

For Google OAuth:

1. [Google Cloud Console](https://console.cloud.google.com) → new project →
   enable the Google+ API → create an OAuth 2.0 Client ID (Web application)
2. Authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
3. Supabase → **Auth → Providers → Google** → paste the Client ID and Secret
4. Set `VITE_GOOGLE_CLIENT_ID` in `.env`

## 6. Run it

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## 7. Build for production

```bash
npm run build      # → dist/
npm run preview     # sanity-check the production build locally
```

## 8. Deploy to Vercel

The repo includes [`vercel.json`](../vercel.json), so importing it is close
to zero-config:

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** →
   pick your fork
2. Vercel reads `vercel.json` and auto-detects the Vite build (`npm run
   build`, output `dist/`) — no changes needed there
3. **Environment Variables** — add the same values from your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_CLIENT_ID` (if using Google sign-in)
4. **Deploy**

Once it's live at `https://your-app.vercel.app` (or a custom domain), two
things need that URL added, or sign-in will fail:

- **Supabase → Authentication → URL Configuration** — add it under **Redirect
  URLs** (and set it as **Site URL** if this is your primary deployment)
- **Google Cloud Console → your OAuth client → Authorized redirect URIs** —
  only needed if you're using Google sign-in; the redirect target is still
  Supabase's callback URL (`https://your-project.supabase.co/auth/v1/callback`),
  not the Vercel URL itself, but Google also requires **Authorized JavaScript
  origins** to include your Vercel URL

Every subsequent push to your default branch redeploys automatically; preview
deployments are created for other branches/PRs (add their preview URL pattern
to Supabase's Redirect URLs too if you rely on preview auth).

### Other static hosts

Not using Vercel? `dist/` is a plain static build — Netlify, Cloudflare
Pages, GitHub Pages, or any static host works the same way: build with `npm
run build`, deploy `dist/`, set the same `VITE_*` env vars at build time, and
add that host's URL to Supabase's Redirect URLs.

## Troubleshooting

**`VITE_SUPABASE_URL is undefined`** — check `.env` exists with the right
keys and restart the dev server (Vite only reads env vars at startup).

**Queries return empty / permission denied** — check RLS policies exist for
the table (see the relevant migration) and that the user is actually
authenticated.

**OAuth redirect loop** — the redirect URI in Google Cloud Console must
exactly match the Supabase callback URL, and `VITE_GOOGLE_CLIENT_ID` must
match the Google Cloud Console client.

**TypeScript errors on build** — run `npm run type-check` for a focused
error list; all shared types live in `src/types/`.
