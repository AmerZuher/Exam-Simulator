-- ExamPro migration 006
-- Run this in Supabase → SQL Editor. Requires no existing duplicate names —
-- see note at the bottom if this errors.

-- Enforces what the app UI already checks client-side (and now blocks with
-- a toast): no two exam banks, and no two exam groups, may share a name for
-- the same user. This also backs the #/exam/<slug> and #/group/<slug> URLs,
-- which resolve by matching a name-derived slug — duplicate names would
-- make two different banks/groups resolve to the same URL.
create unique index exams_user_name_unique on exams (user_id, lower(name));
create unique index exam_groups_user_name_unique on exam_groups (user_id, lower(name));

-- If either CREATE INDEX above fails with "could not create unique index —
-- duplicate key value violates unique constraint", you already have two
-- banks (or groups) with the same name (case-insensitive). Find them with:
--
--   select user_id, lower(name), count(*) from exams group by 1, 2 having count(*) > 1;
--   select user_id, lower(name), count(*) from exam_groups group by 1, 2 having count(*) > 1;
--
-- Rename or delete the duplicates in the app, then re-run this file.
