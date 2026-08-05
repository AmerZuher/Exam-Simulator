-- ExamPro migration 002
-- Run this in Supabase → SQL Editor. Safe to run once; re-running the
-- `add column` statements will error harmlessly if already applied (ignore
-- "already exists" errors on a second run).

-- 1. Rename the old "branding" columns to real user-profile columns.
--    (full_name/tagline describe the signed-in person, not the app itself.)
alter table profiles rename column app_name to full_name;
alter table profiles rename column app_tagline to tagline;

-- 2. Let exam groups have their own icon + colour, same as exam banks
--    already do — needed for the group "Edit" picker (icon/tone/name/desc).
alter table exam_groups add column icon text default 'layers';
alter table exam_groups add column color text default 'acc';
