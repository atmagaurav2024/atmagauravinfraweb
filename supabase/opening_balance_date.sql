-- Lets an account's Opening Balance apply "as on" a date, so older entries (e.g. imported petty cash history)
-- dated before it are left out of that account's balance, statement and reports.
-- Run once in the Supabase SQL Editor.
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS opening_date date;
NOTIFY pgrst, 'reload schema';
