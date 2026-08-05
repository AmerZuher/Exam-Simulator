-- ExamPro migration 005
-- Run this in Supabase → SQL Editor. Safe to run once.

-- Powers the Progress page's study-activity heatmap, day streaks, minutes
-- answered, and the weak-spots list — none of which are derivable from
-- exam_attempts/study_sessions alone (those only hold the LATEST SRS state
-- per question, not a day-by-day or seen/streak history).

-- 1. One row per user per calendar day, incremented every time a question
--    is answered (exam, practice, or review).
create table activity_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  answered integer not null default 0,
  reviews integer not null default 0,
  correct integer not null default 0,
  seconds integer not null default 0,
  attempts integer not null default 0,
  primary key (user_id, day)
);

alter table activity_log enable row level security;

create policy "Users can view own activity" on activity_log
  for select using (auth.uid() = user_id);

create policy "Users can insert own activity" on activity_log
  for insert with check (auth.uid() = user_id);

create policy "Users can update own activity" on activity_log
  for update using (auth.uid() = user_id);

-- 2. Per-question lifetime performance (seen/correct/streak/timing),
--    updated from every grading event across Exam, Practice and Review —
--    this is what "weak spots" ranks by.
create table question_perf (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  seen integer not null default 0,
  correct integer not null default 0,
  streak integer not null default 0,      -- positive run of correct, negative run of incorrect
  worst integer not null default 0,       -- lifetime miss count
  ms integer not null default 0,          -- smoothed average time spent, milliseconds
  updated_at timestamp default now(),
  primary key (user_id, question_id)
);

alter table question_perf enable row level security;

create policy "Users can view own question perf" on question_perf
  for select using (auth.uid() = user_id);

create policy "Users can insert own question perf" on question_perf
  for insert with check (auth.uid() = user_id);

create policy "Users can update own question perf" on question_perf
  for update using (auth.uid() = user_id);

-- 3. Lapse count per SM-2 card ("Again" grades) — needed for the weak-spot
--    difficulty score, which factors in ease *and* how often a card has
--    been forgotten, not just current accuracy.
alter table study_sessions add column lapses integer not null default 0;
