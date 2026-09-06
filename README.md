<div align="center">

<img src="docs/images/logo.svg" width="88" height="88" alt="ExamPro logo">

# ExamPro

**Import any question bank. Study it with spaced repetition. Pass the real thing.**

[![License: MIT](https://img.shields.io/badge/License-MIT-6366f1.svg)](LICENSE)
![React](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)
![TypeScript](https://img.shields.io/badge/typed-TypeScript-3178c6)
![Supabase](https://img.shields.io/badge/backend-Supabase-3ecf8e)
![PWA](https://img.shields.io/badge/PWA-installable-a855f7)
<img width="1376" height="768" alt="ExamPRO_coverIMG" src="https://github.com/user-attachments/assets/4992243b-3df6-4cb4-ab4b-2ec26abd63ef" /></picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/dashboard-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/images/dashboard-light.png">

</div>

---

## Contents

- [What this is](#what-this-is)
- [Features](#features)
- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [Bring your own question bank](#bring-your-own-question-bank)
  - [Generate one with AI](#dont-have-a-question-bank-generate-one-with-ai)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Your data](#your-data)
- [Security](#security)
- [Deploying your own copy](#deploying-your-own-copy)
- [FAQ](#faq)
- [Credits](#credits)
- [License](#license)

---

## What this is

ExamPro turns a plain markdown or JSON question bank into three different ways to
learn it:

1. **Study** — every question and its answer, side by side, searchable and
   filterable, with a "quiz me" mode that hides answers until you ask.
2. **Review** — one card at a time, active recall, scheduled by an SM-2 spaced
   repetition engine so the cards you're shaky on come back sooner and the ones
   you know get pushed weeks out.
3. **Exam** — a timed, scored simulation with a countdown, question pools
   ("weak spots", "due for review", "never seen"), and a results page that
   tells you not just your score but *where the clock went*.

It's a React + Vite single-page app backed by Supabase (Postgres + Auth):
sign in, and your banks, scores and review schedule sync to your account and
follow you across devices.

## Features

<table>
<tr><td width="50%" valign="top">

**Study system**

- SM-2 spaced repetition (ease factor, intervals, lapses)
- 4-grade active recall — Again / Hard / Good / Easy
- Mastery stars, print-to-PDF Q&A sheets
- Search, filter by type / mastered / due

**Exam engine**

- Smart pools: everything, weak spots, due, never-seen, mastered-only
- Optional countdown timer with auto-submit
- Shuffle questions and/or options
- Flag-for-review, resume an in-progress exam later
- Custom exams mixing several banks, and a dedicated Practice mode

</td><td width="50%" valign="top">

**Progress & analytics**

- Score trend, study-activity heatmap, review forecast
- Accuracy by question type
- Weak-spot list with one-click drill sessions
- Pace analysis on every result — slow *and* wrong vs. fast *and* wrong

**Everything else**

- Command palette (`Ctrl/⌘ K`) — fuzzy search banks, groups, and question text
- Exam groups for organizing related banks, each with its own logo and stats
- Google or email/password sign-in, per-account data isolation
- Editable profile (name, role, avatar), theme + accent colour, daily goal
  and review-size defaults, and pinned sidebar shortcuts — all per account
- Installable PWA

</td></tr>
</table>

## Screenshots

<table>
<tr>
<td width="50%"><img src="docs/images/review-card.png" alt="Flashcard review, graded"></td>
<td width="50%"><img src="docs/images/exam-session.png" alt="Timed exam session"></td>
</tr>
<tr>
<td width="50%"><img src="docs/images/progress-dark.png" alt="Progress analytics"></td>
<td width="50%"><img src="docs/images/command-palette.png" alt="Command palette"></td>
</tr>
</table>

<details>
<summary>Settings — profile, appearance, study defaults, and pinned sidebar shortcuts</summary>
<br>
<img src="docs/images/settings.png" alt="Settings page">
</details>

## Quick start

```bash
git clone https://github.com/AmerZuher/Exam-Simulator.git
cd Exam-Simulator
npm install
```

This app needs a Supabase project to sign in and store data — there's no
offline/local-only mode. Two things before `npm run dev` will show real data:

1. Create a Supabase project, then run
   **[`migrations/000_fresh_install.sql`](migrations/000_fresh_install.sql)**
   in its SQL Editor — this single script creates every table (profiles,
   exam groups, exams, questions, study sessions, exam attempts, activity
   log) with Row-Level Security already configured.
2. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key.

Full walkthrough, including Google OAuth and what to run instead of
`000_fresh_install.sql` if you already have data to keep: **[docs/SETUP.md](docs/SETUP.md)**.

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Bring your own question bank

Import → paste markdown or JSON → the importer validates it live and tells you
exactly what didn't parse and why.

**Markdown**, the fast way to write a bank by hand:

```md
### 1. Which learning technique uses increasing intervals between reviews to boost retention?
- [ ] Massed practice
- [ ] Spaced repetition
- [ ] Cramming
- [ ] Random review

### 2. Select all that apply: which are primary colors?
- [ ] Red
- [ ] Green
- [ ] Blue
- [ ] Purple

### 3. Matching: pair each term with its definition.
- [ ] Alpha
- [ ] Beta
Definition A: first letter
Definition B: second letter

### Answer Key
| Question Number | Correct Answer |
| :-- | :-- |
| 1 | Spaced repetition |
| 2 | • Red <br>• Blue |
| 3 | Alpha, Beta |
```

Supported out of the box: single choice, multi-select, true/false, matching,
letter-keyed answers (`B`, `c)`), answer keys as a table *or* a list, images
(`![alt](path)`), audio (`[audio: file.mp3]`) and video (`[video: file.mp4]`).
Numbering can restart across sections of the same document — everything gets
renumbered on import.

### Don't have a question bank? Generate one with AI

You don't have to write questions by hand. Both the Dashboard and the Import
page have a **"Generate with AI" / "Copy AI prompt"** button — click it and a
prompt is copied to your clipboard, pre-written to make any AI chat (ChatGPT,
Claude, Gemini, whatever you use) output questions in exactly the format
ExamPro's parser expects. There's also a **Beta** in-app Generator screen that
previews the same flow end-to-end — it isn't wired to a live AI pipeline yet,
so **Copy AI prompt** is the working path today.

1. Click **Copy AI prompt**.
2. Paste it into your AI chat of choice, then paste in your own source
   material underneath — lecture notes, a textbook chapter, a study guide,
   documentation, anything you want to be quizzed on.
3. The AI generates a full question set — single choice, multi-select,
   true/false, matching — already formatted as valid ExamPro markdown, answer
   key included.
4. Copy its output straight into the **Paste content** box on the Import page
   and hit **Parse & save bank**.

No manual formatting, no guessing the syntax — the prompt tells the AI the
exact rules (heading format, option style, matching layout, answer key
table) so what comes back imports cleanly on the first try.

**JSON** works too — either a bare array of questions or the
`{ "name", "questions": [...] }` shape produced by *Export as JSON*. Paste
your own hand-written JSON and the importer fills in anything you omit.

For the complete, working reference — every question type, every answer-key
style, image/audio/video attachments, all annotated — see
[`Exams/ExamPro Feature Showcase.md`](<Exams/ExamPro Feature Showcase.md>)
(and its [JSON twin](<Exams/ExamPro Feature Showcase.json>)). Import it and
open Study to see exactly how each part was parsed.

## Keyboard shortcuts

| Key                         | Where    | Does                                              |
| --------------------------- | -------- | ------------------------------------------------- |
| `Ctrl/⌘ K`                  | anywhere | Open the command palette                          |
| `D` / `R` / `P` / `I` / `S` | anywhere | Dashboard / Review / Progress / Import / Settings |
| `?`                         | anywhere | Keyboard shortcut help                            |
| `/`                         | Study    | Focus the search box                              |
| `← →`                       | Exam     | Previous / next question                          |
| `1–9`                       | Exam     | Select an answer option                           |
| `F`                         | Exam     | Flag the current question                         |
| `Space`                     | Review   | Flip the card                                     |
| `1 2 3 4`                   | Review   | Grade: Again / Hard / Good / Easy                 |

## How it works

- **React + TypeScript**, built with **Vite**. Views live in
  `src/components/views/`, shared UI in `src/components/ui/`, cross-cutting
  state (auth, theme, exams, groups) in `src/contexts/`.
- **Supabase** is the backend — Postgres for storage, Supabase Auth for
  sign-in (Google or email/password). All queries go through
  `src/services/`, never straight from components.
- **Row-Level Security** on every table means a signed-in user only ever
  sees their own exams, questions, sessions and attempts — enforced by
  Postgres, not app code.
- **The database schema is plain SQL**, not an ORM — see
  [`migrations/`](migrations) and [docs/SETUP.md](docs/SETUP.md) for which
  script to run and when.
- **The SM-2 scheduler** (`src/utils/srs.ts`) and the **markdown/JSON
  importer** (`src/utils/parser.ts`) are both plain, DOM-free TypeScript —
  unit-testable without a browser.
- **Installable.** `public/manifest.json` + `public/service-worker.js` make
  it a PWA that caches itself for offline use.

## Project structure

```
index.html                    Vite entry point
public/
  manifest.json                 PWA manifest
  service-worker.js             offline cache
src/
  App.tsx, main.tsx             routing (hash-based) and bootstrap
  components/
    ui/                          shared primitives — Button, Input, Card, Modal, Badge, Dropdown, Toast
    layout/                      AppShell, Sidebar, CommandPalette
    views/                       Dashboard, Study, Review, Exam, Practice, Results,
                                  Progress, Settings, Importer, Generator, Group, Login
  contexts/                     Auth, Profile, Exams, Groups, DashboardStats, Theme, Toast, Dialog, ...
  hooks/                        thin hooks over the contexts above
  services/                     all Supabase calls — supabase.ts client, examsService,
                                  profilesService, activityService
  utils/
    srs.ts                       SM-2 scheduler
    parser.ts                    markdown/JSON → question bank (DOM-free, unit-testable)
    icons.tsx, slug.ts, ...
  styles/app.css                 the entire design system — one file, CSS custom properties
migrations/                    Supabase SQL schema — run 000_fresh_install.sql for a new
                                project, see docs/SETUP.md for upgrading an existing one
Exams/                         a sample question bank demonstrating every supported format
docs/                          setup, testing, and screenshots
```

## Your data

Banks, scores, the review schedule, and your account preferences all live in
your own Supabase project's Postgres database, scoped to your signed-in
account via Row-Level Security — nobody else can read or write your rows,
including other users of the same deployment.

Because it's your Supabase project, you own the database: back it up,
inspect it with SQL, or export any individual bank as JSON from its menu on
the Dashboard at any time.

## Security

The React app is treated as untrusted — it never holds elevated access.
Every real protection lives in Postgres, on the database itself:

- **Row-Level Security on every table.** `migrations/000_fresh_install.sql`
  enables RLS on `profiles`, `exam_groups`, `exams`, `questions`,
  `study_sessions`, `exam_attempts`, `activity_log`, and `question_perf`,
  with every policy scoped to `auth.uid()` — a signed-in user's queries
  physically cannot return or modify another user's rows, no matter what the
  client sends. Child tables (`questions`, `study_sessions`, ...) inherit
  ownership through the parent `exam`/`user_id`, checked the same way.
- **Only the public anon key ships to the browser.** `VITE_SUPABASE_ANON_KEY`
  is designed to be public — it has no privileges beyond what RLS grants the
  authenticated user holding it. The Supabase `service_role` key (which
  bypasses RLS) is never used client-side and isn't referenced anywhere in
  `src/`.
- **No unsafe HTML rendering.** Imported question banks (markdown/JSON,
  potentially from someone else) are parsed into plain data and rendered as
  ordinary React children, which auto-escapes. There's exactly one
  `dangerouslySetInnerHTML` in the codebase (`src/utils/icons.tsx`), and it
  only ever renders a hardcoded, developer-authored icon set — never
  imported or user-supplied content.
- **Your own AI provider key stays yours.** If you set one in Settings, it's
  stored in `profiles.ai_api_key`, readable only by your own account under
  the same RLS policy as the rest of your profile.

This was verified with a dedicated security pass before this stack was
published (RLS policies read line-by-line, every Supabase call site
checked, auth/redirect flow traced) — no exploitable issue was found.

## Deploying your own copy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AmerZuher/Exam-Simulator&env=VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY,VITE_GOOGLE_CLIENT_ID&envDescription=Supabase%20project%20URL%2Fanon%20key%20(required)%20and%20Google%20OAuth%20client%20ID%20(optional)&envLink=https://github.com/AmerZuher/Exam-Simulator/blob/master/docs/SETUP.md&project-name=exampro&repository-name=exampro)

1. Set up a Supabase project and run
   [`migrations/000_fresh_install.sql`](migrations/000_fresh_install.sql)
2. Click **Deploy with Vercel** above (reads [`vercel.json`](vercel.json),
   zero build config needed) and fill in the environment variables it asks
   for
3. Once it's live, add the deployed URL to **Supabase → Authentication →
   URL Configuration → Redirect URLs** — sign-in fails without this step

Full walkthrough, including Google OAuth setup and deploying to other static
hosts (Netlify, Cloudflare Pages, GitHub Pages): [docs/SETUP.md](docs/SETUP.md#8-deploy-to-vercel).

## FAQ

**Does this need an internet connection?**
Yes — banks, scores and the review schedule are stored in Supabase, so you
need connectivity to sign in and sync. The app shell itself is installable
as a PWA and caches for offline browsing of already-loaded data.

**Can I use it on my phone?**
Yes — it's responsive, and installable as a PWA from a browser's "Add to Home
Screen" menu.

**Can multiple people use the same deployment?**
Yes — each person signs in with their own account and Row-Level Security
keeps everyone's banks, scores and progress isolated from everyone else's.

**What happens if I clear my browser data?**
Nothing — your data lives in Supabase, not the browser. Sign in again on any
device and it's all there.

## Credits

The idea for this project started as a collaboration between **Kimi K3** and
**DeepSeek V4 Pro**. The UI overhaul, feature buildout, and the React +
Supabase rebuild in this version were done with **Claude Opus 5** and
**Claude Sonnet 5** (Anthropic), via Claude Code.

## License

MIT — see [LICENSE](LICENSE). Do what you want with it; attribution is
appreciated but not required.

---

<div align="center">
<sub>Built for people who'd rather study the material than fight the tool.</sub>
</div>
