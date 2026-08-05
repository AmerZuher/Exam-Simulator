-- ExamPro — fresh install
-- Run this ONCE in Supabase → SQL Editor. It drops and recreates every app
-- table with the current schema (profiles, exam_groups, exams, questions,
-- study_sessions, exam_attempts, activity_log, question_perf).
--
-- Only use this if you don't need to keep any existing data — it is
-- destructive. If you have real data to preserve instead, run
-- migrations/002 through 005 in order against your existing schema instead
-- of this file.

drop table if exists question_perf cascade;
drop table if exists activity_log cascade;
drop table if exists exam_attempts cascade;
drop table if exists study_sessions cascade;
drop table if exists questions cascade;
drop table if exists exams cascade;
drop table if exists exam_groups cascade;
drop table if exists profiles cascade;

create extension if not exists "uuid-ossp";

-- ---------------- profiles ----------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  tagline text,
  avatar_url text,
  theme text default 'light' check (theme in ('light', 'dark', 'oled', 'tokyo-night', 'nord', 'sepia')),
  accent text default 'indigo',
  accent_custom text,
  sidebar_collapsed boolean default false,
  daily_goal integer default 20,
  review_size integer default 20,
  ai_provider text default 'openai',
  ai_model text,
  ai_api_key text,
  sidebar_links jsonb default '[]'::jsonb,
  created_at timestamp default now(),
  updated_at timestamp default now()
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- ---------------- exam_groups ----------------
create table exam_groups (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  icon text default 'layers',
  color text default 'acc',
  logo text,
  links jsonb default '[]'::jsonb,
  created_at timestamp default now(),
  updated_at timestamp default now()
);
alter table exam_groups enable row level security;
create policy "Users can view own exam groups" on exam_groups for select using (auth.uid() = user_id);
create policy "Users can create exam groups" on exam_groups for insert with check (auth.uid() = user_id);
create policy "Users can update own exam groups" on exam_groups for update using (auth.uid() = user_id);
create policy "Users can delete own exam groups" on exam_groups for delete using (auth.uid() = user_id);
-- Names must be unique per user — #/group/<slug> URLs resolve by name.
create unique index exam_groups_user_name_unique on exam_groups (user_id, lower(name));

-- ---------------- exams ----------------
create table exams (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references exam_groups(id) on delete set null,
  name text not null,
  description text,
  icon text,
  color text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);
alter table exams enable row level security;
create policy "Users can view own exams" on exams for select using (auth.uid() = user_id);
create policy "Users can create exams" on exams for insert with check (auth.uid() = user_id);
create policy "Users can update own exams" on exams for update using (auth.uid() = user_id);
create policy "Users can delete own exams" on exams for delete using (auth.uid() = user_id);
-- Names must be unique per user — #/exam/<slug> URLs resolve by name.
create unique index exams_user_name_unique on exams (user_id, lower(name));

-- ---------------- questions ----------------
create table questions (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid not null references exams(id) on delete cascade,
  "order" integer not null default 0,
  type text not null check (type in ('single', 'multiple', 'matching')),
  question text not null,

  options jsonb default '[]'::jsonb,
  correct_indices jsonb default '[]'::jsonb,

  left_items jsonb default '[]'::jsonb,
  right_items jsonb default '[]'::jsonb,
  correct_answers jsonb default '{}'::jsonb,

  images jsonb default '[]'::jsonb,
  audios jsonb default '[]'::jsonb,
  videos jsonb default '[]'::jsonb,
  explanation jsonb,
  difficulty text,

  created_at timestamp default now(),
  updated_at timestamp default now()
);
alter table questions enable row level security;
create policy "Users can view questions of own exams" on questions for select using (exam_id in (select id from exams where user_id = auth.uid()));
create policy "Users can create questions in own exams" on questions for insert with check (exam_id in (select id from exams where user_id = auth.uid()));
create policy "Users can update questions in own exams" on questions for update using (exam_id in (select id from exams where user_id = auth.uid()));
create policy "Users can delete questions in own exams" on questions for delete using (exam_id in (select id from exams where user_id = auth.uid()));

-- ---------------- study_sessions ----------------
create table study_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  grade integer check (grade in (1, 2, 3, 4)),
  ease_factor float default 2.5,
  interval integer default 1,
  next_review timestamp default now(),
  mastered boolean not null default false,
  lapses integer not null default 0,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(user_id, question_id, exam_id)
);
alter table study_sessions enable row level security;
create policy "Users can view own study sessions" on study_sessions for select using (auth.uid() = user_id);
create policy "Users can create study sessions" on study_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own study sessions" on study_sessions for update using (auth.uid() = user_id);

-- ---------------- exam_attempts ----------------
create table exam_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references exams(id) on delete cascade, -- null for a cross-bank "custom exam" — see `origin`
  mode text not null default 'exam' check (mode in ('exam', 'practice')),
  label text,
  score integer not null,
  correct_count integer not null,
  total_questions integer not null,
  time_taken integer,
  pass_pct integer default 70,
  passed boolean not null default false,
  started_at timestamp default now(),
  completed_at timestamp,
  results jsonb,
  origin jsonb, -- AttemptOrigin[] — per-question owning bank, for custom/mixed exams only
  created_at timestamp default now()
);
alter table exam_attempts enable row level security;
create policy "Users can view own exam attempts" on exam_attempts for select using (auth.uid() = user_id);
create policy "Users can create exam attempts" on exam_attempts for insert with check (auth.uid() = user_id);

-- ---------------- activity_log ----------------
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
create policy "Users can view own activity" on activity_log for select using (auth.uid() = user_id);
create policy "Users can insert own activity" on activity_log for insert with check (auth.uid() = user_id);
create policy "Users can update own activity" on activity_log for update using (auth.uid() = user_id);

-- ---------------- question_perf ----------------
create table question_perf (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  seen integer not null default 0,
  correct integer not null default 0,
  streak integer not null default 0,
  worst integer not null default 0,
  ms integer not null default 0,
  updated_at timestamp default now(),
  primary key (user_id, question_id)
);
alter table question_perf enable row level security;
create policy "Users can view own question perf" on question_perf for select using (auth.uid() = user_id);
create policy "Users can insert own question perf" on question_perf for insert with check (auth.uid() = user_id);
create policy "Users can update own question perf" on question_perf for update using (auth.uid() = user_id);
