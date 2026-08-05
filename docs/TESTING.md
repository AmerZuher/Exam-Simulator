# Testing guide

Manual workflows for exercising each feature end-to-end against a real
Supabase project. There is no automated test suite yet — this is the
checklist to run through after a change that touches data flow.

Setup: follow [SETUP.md](SETUP.md), then `npm run dev` and sign in.

## Study

1. Dashboard → **Study** → pick an exam bank
2. Verify: questions load from Supabase, search filters correctly, quiz mode
   hides/reveals answers, grid is responsive, back button returns to bank
   selection

## Review (spaced repetition)

1. Dashboard → **Review** → pick an exam bank
2. Reveal the answer, grade it (Again / Hard / Good / Easy), confirm the next
   question loads and the progress bar advances
3. Check `study_sessions` in Supabase after a few grades:
   ```sql
   select question_id, grade, ease_factor, interval, next_review
   from study_sessions
   where user_id = '...'
   order by updated_at desc limit 5;
   ```
   Expect: `ease_factor` moves with grade, `interval` grows on Good/Easy and
   resets to 1 on Again, `next_review` moves into the future.

## Exam

1. **Untimed:** Dashboard → **Exam** → pick a bank, leave duration blank →
   verify navigation, flagging, and results (score, correct/total, time
   stats) after submit
2. **Timed:** set a duration with auto-submit on → verify the countdown,
   pause/resume, and auto-submit at zero
3. Check `exam_attempts` after submit — `score`, `total_questions`,
   `time_taken`, `completed_at` should all be populated

## Practice / custom exams

- Confirm a mixed exam built from multiple banks records `origin` per
  question in `exam_attempts` and still feeds Results/Progress correctly

## Progress

- Verify summary stats (exams, questions, mastered, due, attempts, average
  accuracy) and the per-exam breakdown match what's actually in
  `study_sessions` / `exam_attempts` for the signed-in user
- Mastery is `ease_factor > 2.8` — grade a question "Easy" a few times and
  confirm it crosses into "Mastered"

## Import / Generator

- Import: paste a markdown or JSON bank, confirm the importer's live
  validation errors are specific and parsing matches
  `Exams/ExamPro Feature Showcase.md`
- Generator: "Copy AI prompt" puts a working prompt on the clipboard; the
  in-app Beta generator produces a bank in the same format

## Settings

- Theme switching (light/dark/oled/tokyo-night/nord/sepia) persists across
  reload; accent color changes propagate live; sign-out clears the session

## Command palette (`Ctrl/⌘ K`)

- Fuzzy search finds banks, groups, and navigation actions; Escape closes it

## Error scenarios

- No exams yet → Dashboard shows an empty-state prompt, not a crash
- Exam with zero questions → Study/Review/Exam show a "no questions" message
  instead of an empty screen
- Network offline / Supabase unreachable → UI shows a loading or error state,
  not a silent hang

## Before shipping a change

- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
- [ ] The views you touched were exercised against real Supabase data, not
      just read through
- [ ] No console errors in the browser during the flows above
