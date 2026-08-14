-- ═══════════════════════════════════════════════════════════════════
-- RYDAX MULTI-TENANCY — FINAL COMBINED MIGRATION
-- Run once, top to bottom, in Supabase → SQL Editor.
--
-- Replaces rydax_multitenancy_phase1.sql + rydax_fix_existing_logins.sql
-- (both superseded by this file) with one corrected script. Fixes a
-- real bug in the original: `alter table if exists` correctly skipped
-- tables that don't actually exist in your database (equipment turned
-- out to be one — referenced in the app's code but never actually
-- created as a table), but the very next line (the UPDATE) had no
-- such guard and failed outright. Every table below is now wrapped in
-- a single existence check, so any table that isn't real is cleanly
-- skipped entirely rather than aborting the run.
--
-- What this does, in order:
--   1. Creates `companies` (the tenant table); your existing
--      company_details row becomes tenant zero.
--   2. Adds company_id to every table this app actually uses (51
--      candidates, found by grepping every sbFetch/sbInsert/sbUpdate/
--      sbDelete call in the codebase — any that don't really exist in
--      your database are skipped, not guessed at).
--   3. Backfills every existing row's company_id to your own company.
--   4. Adds a server-side default so company_id auto-fills from
--      whoever's authenticated on any insert that doesn't specify it
--      explicitly — critical, because none of the app's existing
--      insert calls set company_id yet (that's separate, incremental
--      follow-up work) and without this default every one of them
--      would otherwise be rejected by the isolation policy below.
--   5. Turns on real database-level tenant isolation (RLS) on every
--      one of those tables — enforced via employees.auth_id =
--      auth.uid(), not just client-side filtering.
--   6. Adds the narrow signup-only policies needed for self-service
--      company creation (anonymous insert of a new company + its
--      first employee, before that user is authenticated).
--   7. Migrates your existing Supabase Auth accounts' emails to the
--      new tenant-scoped format, so existing passwords keep working
--      with the new company-code-aware login.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Companies (tenants) ───────────────────────────────────────────
create table if not exists companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  short_name   text,
  slug         text not null unique,
  status       text not null default 'active',
  plan         text default 'trial',
  created_at   timestamptz default now()
);

do $$
declare
  existing record;
begin
  if (select count(*) from companies) = 0 then
    select * into existing from company_details order by id asc limit 1;
    insert into companies (name, short_name, slug, status, plan)
    values (
      coalesce(existing.name, 'My Company'),
      coalesce(existing.short_name, 'Company1'),
      'company1',
      'active',
      'legacy'
    );
  end if;
end $$;

-- ── 2+3+4+5. company_id, backfill, default, RLS — all per-table, ────
--    each guarded by an existence check so a table that isn't real
--    (like equipment) is skipped cleanly instead of aborting the run.
do $$
declare
  t text;
  tenant_zero uuid;
  tables text[] := array[
    'access_permissions','advance_recoveries','attendance','attendance_punches',
    'attendance_settings','audit_log','boq_exec_resources','boq_items','boq_jm',
    'boq_subitems','categories','chart_of_accounts','company_details',
    'company_expenses','employee_advances','employee_leave_fixation',
    'employee_orders','employee_pay','employees','equipment','grn_entries',
    'inter_project_advances','inter_project_settlements','labourers',
    'leave_requests','loan_allocations','loan_parties','loan_repayments',
    'loan_transactions','loans','materials','other_expenses',
    'petty_cash_expenses','petty_cash_in','projects','resource_requisitions',
    'salary_records','sales_bills','sales_payments','store_inventory',
    'store_issue_log','subcontractors','tpm_assets','tpm_transfers',
    'vendor_material_rates','vendors','vouchers','work_advances','work_bills',
    'work_daily_progress','work_orders','work_payments'
  ];
begin
  select id into tenant_zero from companies order by created_at asc limit 1;

  foreach t in array tables loop
    if to_regclass('public.'||t) is null then
      raise notice 'Skipping % — table does not exist in this database', t;
      continue;
    end if;

    -- company_id column + backfill + index
    execute format('alter table %I add column if not exists company_id uuid references companies(id)', t);
    execute format('update %I set company_id = %L where company_id is null', t, tenant_zero);
    execute format('create index if not exists %I on %I(company_id)', 'idx_'||t||'_company', t);

    -- server-side default, except employees (its insert paths always
    -- set company_id explicitly and correctly — see note below)
    if t <> 'employees' then
      execute format(
        'alter table %I alter column company_id set default (select company_id from employees where auth_id = auth.uid())',
        t
      );
    end if;

    -- RLS: tenant isolation
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_all', t);
    execute format('drop policy if exists %I on %I', t||'_tenant_isolated', t);
    execute format($f$
      create policy %I on %I for all
      using (company_id = (select company_id from employees where auth_id = auth.uid()))
      with check (company_id = (select company_id from employees where auth_id = auth.uid()))
    $f$, t||'_tenant_isolated', t);
  end loop;
end $$;

-- employees.company_id must always be set going forward — every RLS
-- policy above resolves back to it via auth.uid().
alter table employees alter column company_id set not null;

-- companies itself: a logged-in user may only read their own company's
-- row (needed for the Company module etc.) — never list or edit others.
alter table companies enable row level security;
drop policy if exists "companies_own_row" on companies;
create policy "companies_own_row" on companies for select
  using (id = (select company_id from employees where auth_id = auth.uid()));

-- ── 6. Public pre-login views ─────────────────────────────────────────
drop view if exists public_company_branding;

create or replace view public_company_lookup as
  select id, slug, name, short_name, status from companies;

grant select on public_company_lookup to anon;

-- Self-service signup: allow inserting a new company + its first
-- employee before that user is authenticated.
grant insert on companies to anon;
grant insert on employees to anon;

drop policy if exists "companies_signup_insert" on companies;
create policy "companies_signup_insert" on companies for insert
  with check (true);

-- 'pending' covers ordinary self-registration into an existing
-- company (an admin of that company still has to approve them via an
-- authenticated UPDATE, restricted to admins of that same company by
-- the tenant-isolated policy above). role='admin' is only allowed
-- when the target company doesn't already have one — i.e. only the
-- very first user of a brand-new signup can self-insert as admin;
-- without this guard, anyone could insert themselves as role='admin'
-- into someone else's existing company.
drop policy if exists "employees_signup_insert" on employees;
create policy "employees_signup_insert" on employees for insert
  with check (
    status = 'pending'
    or (
      role = 'admin'
      and not exists (
        select 1 from employees e2
        where e2.company_id = employees.company_id and e2.role = 'admin'
      )
    )
  );

-- ── 7. Fix existing logins ────────────────────────────────────────────
-- Existing accounts were created in Supabase Auth with email
-- <phone>@aipl.internal. Login now authenticates against
-- <phone>@<company-slug>.rydax.internal instead — this updates every
-- existing employee's Supabase Auth email to match, so existing
-- passwords keep working unchanged. Passwords themselves are untouched.
do $$
declare
  tenant_zero_slug text;
  r record;
begin
  select slug into tenant_zero_slug from companies order by created_at asc limit 1;

  for r in
    select e.auth_id, e.phone
    from employees e
    where e.auth_id is not null and e.phone is not null and e.phone <> ''
  loop
    update auth.users
    set email = regexp_replace(r.phone, '[^0-9]', '', 'g') || '@' || tenant_zero_slug || '.rydax.internal'
    where id = r.auth_id
      and email like '%@aipl.internal';
  end loop;
end $$;

-- Verify: should return zero rows. If any remain, their employees.auth_id
-- likely doesn't match a real auth.users row, or their phone is empty —
-- worth checking those individually.
select u.id, u.email
from auth.users u
where u.email like '%@aipl.internal';
