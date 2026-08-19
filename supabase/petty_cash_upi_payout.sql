-- Petty Cash UPI payout support
-- Run once in Supabase → SQL Editor.
--
-- Adds payee UPI details and payout status tracking to
-- petty_cash_expenses. payout_status distinguishes plain cash entries
-- (not_applicable — the existing, unaffected flow) from UPI payouts
-- initiated through RazorpayX, which move through
-- pending -> processing -> success/failed as the webhook reports back.

alter table petty_cash_expenses add column if not exists payee_upi_id text;
alter table petty_cash_expenses add column if not exists payee_name text;
alter table petty_cash_expenses add column if not exists payout_status text not null default 'not_applicable';
-- not_applicable | pending | processing | success | failed
alter table petty_cash_expenses add column if not exists payout_ref text;   -- RazorpayX payout id
alter table petty_cash_expenses add column if not exists payout_utr text;   -- bank UTR, once settled
alter table petty_cash_expenses add column if not exists payout_failure_reason text;

create index if not exists idx_pce_payout_status on petty_cash_expenses(payout_status);

-- Per-company RazorpayX payout credentials. Petty cash is money going
-- OUT of a company's own account to a vendor, so this is deliberately
-- per-company (not a shared platform-level account like the
-- subscription Razorpay integration, which collects money INTO
-- Rydax's own account) - each company connects their own RazorpayX
-- business account.
create table if not exists company_payout_settings (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid unique not null references companies(id) on delete cascade,
  razorpayx_account_number text,
  razorpayx_key_id         text,
  razorpayx_key_secret     text,   -- only ever read server-side, in the edge function, via service role
  is_active                boolean default false,
  updated_at               timestamptz default now()
);

alter table company_payout_settings enable row level security;
drop policy if exists company_payout_settings_tenant_isolated on company_payout_settings;
create policy company_payout_settings_tenant_isolated on company_payout_settings for all
  using (company_id = current_company_id())
  with check (company_id = current_company_id());

