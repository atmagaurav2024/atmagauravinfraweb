-- Loans — Payment Type (separate from Interest Type)
-- Run once in Supabase → SQL Editor.
--
-- Payment Type: 'emi' (Monthly EMI Payment) or 'anytime' (Pay Anytime).
-- Interest Type (simple/yearly/halfyearly/quarterly/monthly) stays
-- purely about interest accrual math and no longer has an 'emi' value -
-- an EMI loan's interest still accrues the same simple, day-wise way,
-- it's just not shown as a separate choice on the form anymore.

alter table loans
  add column if not exists payment_type text not null default 'anytime';
