-- ExamPro migration 003
-- Run this in Supabase → SQL Editor. Safe to run once.

-- Lets an exam group use an uploaded image as its badge instead of a
-- built-in icon (upload is a group-only feature — exam banks keep the
-- icon-only picker). Mirrors exams/questions' pattern of storing images as
-- data URIs directly on the row rather than a separate storage bucket.
alter table exam_groups add column logo text;
