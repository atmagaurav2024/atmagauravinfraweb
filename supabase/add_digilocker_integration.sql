-- Real, automated DigiLocker verification (Phase B) via Sandbox.co.in —
-- adds on top of add_kyc_digilocker_columns.sql (run that one first if
-- you haven't already; this migration assumes those columns exist).
--
-- With this, the company's own Sandbox.co.in account can pull a
-- person's Aadhaar + PAN directly from DigiLocker into the record, once
-- that person logs into DigiLocker themselves and grants consent — no
-- manual upload or DigiLocker "Verify Document" check-by-hand needed
-- for those two documents. Education certificates still have no
-- automated path (Sandbox.co.in's DigiLocker API doesn't offer them),
-- so that upload box and manual Verify/Reject stay as-is.

-- One row per company: their own Sandbox.co.in credentials. Get these
-- by signing up at https://www.sandbox.co.in, verifying your business,
-- and creating an API key under their dashboard. Mirrors
-- company_payout_settings (petty_cash_upi_payout.sql) exactly - a
-- separate `id` primary key plus a unique `company_id`, so sbUpdate's
-- `?id=eq.<id>` convention works the same way here.
create table if not exists company_kyc_settings (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid unique not null references companies(id) on delete cascade,
  sandbox_api_key     text,
  sandbox_api_secret  text,   -- only ever read server-side, in the edge functions, via service role
  sandbox_env         text default 'test', -- 'test' | 'production'
  is_active           boolean default false,
  updated_at          timestamptz default now()
);

alter table company_kyc_settings enable row level security;
drop policy if exists company_kyc_settings_tenant_isolated on company_kyc_settings;
create policy company_kyc_settings_tenant_isolated on company_kyc_settings for all
  using (company_id = current_company_id())
  with check (company_id = current_company_id());

-- Tracks the in-progress DigiLocker consent session for a record, so
-- digilocker-check knows which session to poll. Cleared back to null
-- once that session finishes (verified or failed).
alter table employees add column if not exists digilocker_session_id text;
alter table vendors add column if not exists digilocker_session_id text;
alter table subcontractors add column if not exists digilocker_session_id text;
alter table labourers add column if not exists digilocker_session_id text;
