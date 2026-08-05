# ExamPro — developer guide

ExamPro is a React + Vite + Supabase exam simulation and spaced-repetition
study app. This file documents the conventions for working on it; see
[README.md](README.md) for what the app does and [docs/SETUP.md](docs/SETUP.md)
for environment/Supabase setup.

## Stack

- **Frontend:** React 18 + TypeScript, built with Vite
- **Backend:** Supabase (Postgres + Auth). No custom server — the client
  talks to Supabase directly through `src/services/`.
- **State:** React Context for global/cross-view state (auth, theme, exams,
  groups, dashboard stats, toasts, dialogs); local `useState` everywhere else.
- **Styling:** Plain CSS with custom properties (`src/styles/app.css`) — no
  CSS-in-JS, no utility framework. Theming (light/dark/oled/tokyo-night/nord/
  sepia) and accent colors are driven entirely by CSS variables.

## Directory structure

```
src/
  components/
    ui/          shared, reusable primitives (Button, Input, Card, Modal, Badge, Dropdown, Toast, ...)
    layout/       app shell (Header/AppShell, Sidebar, CommandPalette)
    views/        one file per screen (Dashboard, Study, Review, Exam, Practice,
                   Results, Progress, Settings, Importer, Generator, Group, Login)
  contexts/       Auth, Profile, Exams, Groups, DashboardStats, Theme, Toast, Dialog,
                  LookPicker, Explanation
  hooks/          thin consumers of the contexts above (useAuth, useExams, useGroups, ...)
  services/       all Supabase calls live here (supabase.ts client, examsService,
                  profilesService, activityService) — components never query
                  Supabase directly
  types/          shared TypeScript types (exam.ts, user.ts)
  utils/          srs.ts (SM-2), parser.ts (markdown/JSON import), icons.tsx, slug.ts, ...
  styles/app.css  the entire design system
public/           static assets served as-is (manifest.json, service-worker.js)
migrations/       Supabase SQL schema, in order — see docs/SETUP.md
```

## Conventions

- **Naming:** components PascalCase, hooks camelCase prefixed `use`,
  types/interfaces PascalCase.
- **DRY:** check `src/components/ui/` before adding a new component; reusable
  UI belongs there, not duplicated inside a view.
- **Data access:** all Supabase reads/writes go through `src/services/*`,
  called from hooks. Views consume hooks, not Supabase directly.
- **Types:** keep full TypeScript coverage; run `npm run type-check` before
  committing.
- **SRS:** the SM-2 algorithm lives in `src/utils/srs.ts`
  (`calculateSRS`, `initializeSRS`, `isDueForReview`) — this is the only
  place scheduling math should live.
- **Import/export parsing:** `src/utils/parser.ts` is DOM-free (pure string
  in, structured questions out) so it stays unit-testable without a browser.

## Build & scripts

```bash
npm install
npm run dev         # Vite dev server, http://localhost:5173
npm run build        # tsc + production build to dist/
npm run preview      # serve the production build locally
npm run type-check   # TypeScript check only, no emit
```

## Database

Schema and RLS policies live in `migrations/` as plain SQL, applied through
the Supabase SQL editor. `000_fresh_install.sql` creates everything from
scratch; `002`–`006` are incremental migrations for existing databases. See
[docs/SETUP.md](docs/SETUP.md) for which one to run.

Every table has Row-Level Security enabled scoped to `auth.uid()` — a user
can only ever read/write their own exams, questions, sessions and attempts.
