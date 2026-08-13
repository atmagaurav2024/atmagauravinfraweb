-- Loans — Date of First EMI
-- Run once in Supabase → SQL Editor. Small, standalone addition to the
-- existing loans table, needed for the "Create EMI Payment" feature
-- and for a future EMI reminder feature.

alter table loans
  add column if not exists first_emi_date date;
