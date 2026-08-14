-- ═══════════════════════════════════════════════════════════════════
-- RYDAX MULTI-TENANCY — FOUNDATION MIGRATION (Phase 1)
-- Run once in Supabase → SQL Editor.
--
-- What this does:
--   1. Creates `companies` (the tenant table) and migrates your
--      existing company_details row into it as tenant zero.
--   2. Adds `company_id` to every table this app uses (51 tables,
--      enumerated by grepping every sbFetch/sbInsert/sbUpdate/sbDelete
--      call in the codebase — not guessed from memory).
--   3. Backfills every existing row's company_id to your own company,
--      so nothing you already have breaks or goes "orphaned".
--   4. Adds company_id to employees specifically (the identity table
--      login depends on) and enforces it's always set going forward.
--   5. Replaces every permissive `using (true)` RLS policy on these
--      tables with one that only allows access to rows in the
--      caller's own company — resolved via employees.auth_id =
--      auth.uid(), the same column the signup flow already writes.
--
-- This is the SAFETY layer: even before every screen in the app is
-- updated to filter its own queries by company_id (that's the
-- follow-up work), no company can read or write another company's
-- rows, because the database itself refuses it.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Companies (tenants) ───────────────────────────────────────────
create table if not exists companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  short_name   text,
  slug         text not null unique,        -- used at login to resolve which tenant a phone number belongs to
  status       text not null default 'active',  -- active | trial | suspended
  plan         text default 'trial',            -- informational only for now — no billing engine yet
  created_at   timestamptz default now()
);

-- Migrate whatever's already in company_details into tenant zero, so
-- your existing data has a real company to attach to below. Only runs
-- if companies is currently empty (safe to re-run this whole file).
do $$
declare
  existing record;
  new_company_id uuid;
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
    )
    returning id into new_company_id;
  end if;
end $$;

-- ── 2. company_id on every table this app uses ───────────────────────
-- Nullable for now (added before backfill), each then backfilled to
-- tenant zero, then made NOT NULL on the identity-critical tables.
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
    execute format('alter table if exists %I add column if not exists company_id uuid references companies(id)', t);
    execute format('update %I set company_id = %L where company_id is null', t, tenant_zero);
    execute format('create index if not exists %I on %I(company_id)', 'idx_'||t||'_company', t);
  end loop;
end $$;

-- employees.company_id must always be set going forward — it's what
-- every RLS policy below resolves back to via auth.uid().
alter table employees alter column company_id set not null;

-- ── 2b. CRITICAL: default company_id from the authenticated user ────
-- None of the app's existing insert calls (hundreds of them, across
-- every module) set company_id explicitly — that work happens
-- incrementally as a follow-up, module by module. Without this step,
-- every one of those inserts would come through with company_id NULL,
-- and the WITH CHECK policy below (company_id = ...) would reject
-- every single one, since NULL = anything is never true in SQL —
-- breaking every write in the app the moment this migration runs.
-- This column default resolves company_id server-side from whoever's
-- actually authenticated, so existing insert calls that don't specify
-- it keep working exactly as before, correctly scoped to the caller's
-- own company automatically.
do $$
declare
  t text;
  tables text[] := array[
    'access_permissions','advance_recoveries','attendance','attendance_punches',
    'attendance_settings','audit_log','boq_exec_resources','boq_items','boq_jm',
    'boq_subitems','categories','chart_of_accounts','company_details',
    'company_expenses','employee_advances','employee_leave_fixation',
    'employee_orders','employee_pay','equipment','grn_entries',
    'inter_project_advances','inter_project_settlements','labourers',
    'leave_requests','loan_allocations','loan_parties','loan_repayments',
    'loan_transactions','loans','materials','other_expenses',
    'petty_cash_expenses','petty_cash_in','projects','resource_requisitions',
    'salary_records','sales_bills','sales_payments','store_inventory',
    'store_issue_log','subcontractors','tpm_assets','tpm_transfers',
    'vendor_material_rates','vendors','vouchers','work_advances','work_bills',
    'work_daily_progress','work_orders','work_payments'
    -- employees is deliberately excluded here: its own insert paths
    -- (signup, admin adding a teammate) already set company_id
    -- explicitly and correctly, since a default resolved from the
    -- *inserting* user's own company wouldn't be right for every case
    -- (e.g. the anon brand-new-company signup path, where the
    -- inserting session has no company yet at all).
  ];
begin
  foreach t in array tables loop
    execute format(
      'alter table if exists %I alter column company_id set default (select company_id from employees where auth_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- ── 3. RLS: every table above, isolated to the caller's own company ──
-- Resolves the caller's company via employees.auth_id = auth.uid() —
-- the same column the registration flow already writes on signup.
-- Replaces the permissive `using (true)` policies from earlier
-- migrations this session with real tenant isolation.
do $$
declare
  t text;
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
  foreach t in array tables loop
    execute format('alter table if exists %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_all', t);
    execute format('drop policy if exists %I on %I', t||'_tenant_isolated', t);
    execute format($f$
      create policy %I on %I for all
      using (company_id = (select company_id from employees where auth_id = auth.uid()))
      with check (company_id = (select company_id from employees where auth_id = auth.uid()))
    $f$, t||'_tenant_isolated', t);
  end loop;
end $$;

-- companies itself: a logged-in user may only read their own company's
-- row (needed for the Company module etc.) — never list or edit others.
alter table companies enable row level security;
drop policy if exists "companies_own_row" on companies;
create policy "companies_own_row" on companies for select
  using (id = (select company_id from employees where auth_id = auth.uid()));

-- ── 4. Public pre-login views ─────────────────────────────────────────
-- public_company_branding previously showed the one company's name
-- before login — that concept doesn't make sense pre-login anymore
-- once there are many companies, so it's dropped. The app now shows
-- static "Rydax" branding pre-login instead (app-side change).
drop view if exists public_company_branding;

-- Anon-readable slug lookup, so the login screen can validate a
-- company code exists before attempting auth, and so a new employee's
-- self-registration can resolve company_id before that user has an
-- authenticated session. id is not sensitive on its own (it's only
-- useful paired with a valid employees row in that company, which
-- everything else in this migration protects) — deliberately exposes
-- nothing else (no financial or personal data), same minimal-surface
-- principle the old view used.
create or replace view public_company_lookup as
  select id, slug, name, short_name, status from companies;

grant select on public_company_lookup to anon;

-- ── 5. Signup support: allow inserting a new company + first employee
--    before that user is authenticated (self-service signup) ─────────
-- Company creation and the very first employee row for it must be
-- insertable by an anonymous (not-yet-authenticated) request, since
-- signup creates both before the Supabase Auth account + login exist.
-- The employees RLS policy above still applies for every other
-- operation (reads, updates, everything after signup) — this only
-- widens the specific INSERT case for brand-new companies/first users.
grant insert on companies to anon;
grant insert on employees to anon;

drop policy if exists "companies_signup_insert" on companies;
create policy "companies_signup_insert" on companies for insert
  with check (true);

-- employees insert check is deliberately narrow: 'pending' covers
-- ordinary self-registration into an existing company (unchanged from
-- before — an admin of that company still has to approve them via an
-- authenticated UPDATE, which the tenant-isolated policy above already
-- restricts to admins of that same company). role='admin' is only
-- allowed when the target company doesn't already have one — i.e. only
-- the very first user of a brand-new signup can self-insert as admin.
-- Without the NOT EXISTS guard, anyone could insert themselves as
-- role='admin' into someone else's existing company — this closes that.
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
