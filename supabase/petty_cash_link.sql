-- Link a Petty Cash expense to the party payment / advance it paid.
-- Run once in the Supabase SQL Editor.
ALTER TABLE petty_cash_expenses
  ADD COLUMN IF NOT EXISTS linked_kind text,   -- 'work_payment' (bill payment) or 'work_advance'
  ADD COLUMN IF NOT EXISTS linked_id   text;   -- id of that payment / advance
NOTIFY pgrst, 'reload schema';
