-- Rydax billing — allow browsing all plans
-- Run once in Supabase → SQL Editor.
--
-- plans_read_own (from the earlier migration) only let a company see
-- its OWN current plan — fine for checking limits, but a company
-- needs to see what OTHER plans exist and cost to actually choose one
-- to upgrade to. Plan pricing/features aren't sensitive data (similar
-- to how public_company_lookup already exposes company names
-- publicly), so this opens plans up to anyone, not just platform
-- admins or "your own plan".

drop policy if exists "plans_read_own" on plans;
drop policy if exists "plans_read_all" on plans;
create policy "plans_read_all" on plans for select
  using (true);
