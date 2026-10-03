-- Adds Cashfree Payouts credential columns to company_payout_settings,
-- alongside the existing razorpayx_* columns (left in place, unused once
-- a company switches to Cashfree — no data loss, no migration needed for
-- companies that never configured RazorpayX).
--
-- Run this once in the Supabase SQL editor before deploying the
-- initiate-cashfree-payout / cashfree-payout-webhook edge functions.

alter table company_payout_settings
  add column if not exists cashfree_client_id text,
  add column if not exists cashfree_client_secret text,
  add column if not exists cashfree_env text default 'sandbox'; -- 'sandbox' or 'production'
