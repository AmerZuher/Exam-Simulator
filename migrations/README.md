# Database scripts — which one do I run?

**Setting up a new Supabase project? Run [`000_fresh_install.sql`](000_fresh_install.sql). That's it — nothing else in this folder.**

Paste it into **Supabase → SQL Editor** and run it once. It creates every
table ExamPro needs — `profiles`, `exam_groups`, `exams`, `questions`,
`study_sessions`, `exam_attempts`, `activity_log`, `question_perf` — with
Row-Level Security already configured, scoped to `auth.uid()` so each user
only ever sees their own data.

It's destructive (drops and recreates the tables), which is exactly what you
want on a brand-new project with nothing in it yet.

---

## Everything else in this folder

`002` through `006` are **not extra setup steps** — `000_fresh_install.sql`
already includes everything they add. They exist for one specific situation:

> You (or whoever set this up) ran an **older version** of `000` before these
> features existed, already have real exams/questions/progress in that
> database, and don't want to lose it by re-running `000` (which would wipe
> everything).

If that's you, run these in order against your existing database instead of
`000` — each is a small, no-data-loss change (add a column, rename a table,
add an index):

| Script | What it does |
|---|---|
| [`002_user_profile_and_group_customization.sql`](002_user_profile_and_group_customization.sql) | Renames the old `app_name`/`app_tagline` table to `profiles`; adds `icon`/`color` to `exam_groups` |
| [`003_group_logo.sql`](003_group_logo.sql) | Adds a `logo` column to `exam_groups` |
| [`004_mixed_exam_attempts.sql`](004_mixed_exam_attempts.sql) | Makes `exam_attempts.exam_id` optional and adds `origin` — enables the cross-bank custom exam builder |
| [`005_activity_and_perf.sql`](005_activity_and_perf.sql) | Adds `activity_log` and `question_perf` — powers the Progress page's heatmap, streaks, and weak-spot list |
| [`006_unique_names.sql`](006_unique_names.sql) | Adds unique indexes so `#/exam/<name>` and `#/group/<name>` URLs resolve correctly |

If you're not in that situation — you're forking the app, setting up a new
Supabase project, nothing to preserve — **ignore this table entirely and just
run `000_fresh_install.sql`.**
