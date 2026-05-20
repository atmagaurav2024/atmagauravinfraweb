-- Fix petty_cash_in not-null constraint on date column
-- Run in Supabase → SQL Editor

ALTER TABLE public.petty_cash_in ALTER COLUMN date DROP NOT NULL;
ALTER TABLE public.petty_cash_in ALTER COLUMN amount DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
