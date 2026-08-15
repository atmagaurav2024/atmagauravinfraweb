-- ═══════════════════════════════════════════════════════════════════
-- RYDAX — PLANS, SUBSCRIPTIONS & SUPER ADMIN FOUNDATION
-- Run once in Supabase → SQL Editor.
--
-- What this adds:
--   1. `plans` — reusable plan templates (Free, Paid, or however many
--      you want) with usage limits and a locked-modules list.
--   2. Extends `companies` with plan_id, trial_ends_at, and
--      subscription_status (trialing / active / lapsed / suspended).
--   3. `platform_admins` — a separate identity layer for you as the
--      Rydax platform owner, distinct from any company's own
--      employees.role='admin' (which is scoped to one company only).
--   4. `payment_history` — logs payments against a company. Empty for
--      now (no gateway connected yet) — this is what a real Razorpay
--      integration will write into once you're ready, and what the
--      Super Admin console can also record manually in the meantime.
--   5. RLS: platform admins get full access to companies/plans/
--      payment_history (and only those — not any company's own
--      operational data, which stays exactly as tenant-isolated as
--      before). Regular company admins still cannot edit their own
--      plan/status/subscription fields — only the platform admin can.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Plans ──────────────────────────────────────────────────────────
create table if not exists plans (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                 -- e.g. "Free", "Pro"
  price_monthly  numeric default 0,              -- informational until a gateway is connected
  max_employees  int,                            -- null = unlimited
  max_projects   int,                            -- null = unlimited
  locked_modules text[] not null default '{}',   -- module keys blocked on this plan, e.g. {'loans','tpm'}
  is_default     boolean not null default false, -- assigned to brand-new signups
  created_at     timestamptz default now()
);

-- Seed two starting plans if none exist yet — edit freely afterward
-- from the Super Admin console, these are just a starting point.
insert into plans (name, price_monthly, max_employees, max_projects, locked_modules, is_default)
select 'Free', 0, 5, 2, array['loans','tpm'], true
where not exists (select 1 from plans);

insert into plans (name, price_monthly, max_employees, max_projects, locked_modules, is_default)
select 'Paid', 999, null, null, array[]::text[], false
where not exists (select 1 from plans where name = 'Paid');

-- ── 2. Extend companies ──────────────────────────────────────────────
alter table companies add column if not exists plan_id uuid references plans(id);
alter table companies add column if not exists trial_ends_at timestamptz default (now() + interval '14 days');
alter table companies add column if not exists subscription_status text not null default 'trialing';
-- trialing | active | lapsed | suspended

-- Assign every existing company (including tenant zero) to the
-- default plan if they don't have one yet.
update companies
set plan_id = (select id from plans where is_default = true limit 1)
where plan_id is null;

-- ── 3. Platform admins ───────────────────────────────────────────────
create table if not exists platform_admins (
  id         uuid primary key default gen_random_uuid(),
  auth_id    uuid unique,           -- links to auth.users, same pattern as employees.auth_id
  name       text,
  email      text,
  created_at timestamptz default now()
);

-- SECURITY DEFINER for the same reason current_company_id() needed
-- it — this needs to bypass RLS on platform_admins to check itself,
-- otherwise checking "is this caller a platform admin" would need to
-- already know the answer to read the table that answers it.
create or replace function is_platform_admin() returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from platform_admins where auth_id = auth.uid())
$$;

alter table platform_admins enable row level security;
drop policy if exists "platform_admins_self" on platform_admins;
create policy "platform_admins_self" on platform_admins for select
  using (auth_id = auth.uid());

-- One-time bootstrap: only works while platform_admins is completely
-- empty, so only the very first platform admin can ever self-register
-- this way — same safe pattern used for the first company admin
-- during company signup. Once one exists, this can never fire again;
-- any additional platform admins have to be added by an existing one
-- through the console itself (protected by is_platform_admin()).
grant insert on platform_admins to anon;
drop policy if exists "platform_admins_bootstrap_insert" on platform_admins;
create policy "platform_admins_bootstrap_insert" on platform_admins for insert
  with check (not exists (select 1 from platform_admins));

drop policy if exists "platform_admins_manage" on platform_admins;
create policy "platform_admins_manage" on platform_admins for all
  using (is_platform_admin())
  with check (is_platform_admin());

-- ── 4. Payment history ───────────────────────────────────────────────
create table if not exists payment_history (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id),
  amount         numeric not null,
  currency       text not null default 'INR',
  status         text not null default 'recorded',  -- recorded (manual) | paid | failed | refunded — gateway integration will use paid/failed
  method         text,                                -- e.g. 'manual', 'razorpay'
  gateway_ref    text,                                -- populated once a real gateway is connected
  period_start   date,
  period_end     date,
  notes          text,
  recorded_by    uuid,                                -- platform_admins.id
  created_at     timestamptz default now()
);
create index if not exists idx_payment_history_company on payment_history(company_id);

alter table payment_history enable row level security;
drop policy if exists "payment_history_platform_admin" on payment_history;
create policy "payment_history_platform_admin" on payment_history for all
  using (is_platform_admin())
  with check (is_platform_admin());

-- A company's own admin can see (read-only) their own payment
-- history — not other companies', and can't edit/delete it.
drop policy if exists "payment_history_own_company_read" on payment_history;
create policy "payment_history_own_company_read" on payment_history for select
  using (company_id = current_company_id());

-- ── 5. Platform admin access to companies & plans ────────────────────
-- Additive — combines via OR with the existing companies_own_row /
-- companies_signup_insert policies, so those keep working exactly as
-- before for regular company admins. This is what lets a platform
-- admin see and manage every company, not just their own.
drop policy if exists "companies_platform_admin_all" on companies;
create policy "companies_platform_admin_all" on companies for all
  using (is_platform_admin())
  with check (is_platform_admin());

alter table plans enable row level security;
drop policy if exists "plans_platform_admin_all" on plans;
create policy "plans_platform_admin_all" on plans for all
  using (is_platform_admin())
  with check (is_platform_admin());

-- Every logged-in user needs to be able to read their own company's
-- plan (for module-locking/usage-limit checks in the app) — read-only,
-- can't modify it themselves.
drop policy if exists "plans_read_own" on plans;
create policy "plans_read_own" on plans for select
  using (id = (select plan_id from companies where id = current_company_id()));
