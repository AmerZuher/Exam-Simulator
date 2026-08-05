-- ExamPro migration 004
-- Run this in Supabase → SQL Editor. Safe to run once.

-- Lets one exam_attempts row represent a "custom exam" built from several
-- banks at once (e.g. the group page's cross-bank builder), which has no
-- single owning bank. `exam_id` becomes optional; `origin` records which
-- bank each question in `results` actually came from, in order, so SRS
-- updates and review can still be attributed correctly per question.
alter table exam_attempts alter column exam_id drop not null;
alter table exam_attempts add column origin jsonb;
