-- Loan Allocation & Inter-Project Financing Ledger — schema
-- Run once in Supabase → SQL Editor. Builds on the existing `loans` table
-- (id, party_id, direction, principal, interest_rate, interest_type,
-- start_date, ...) rather than replacing it — a loan's own identity,
-- party, and principal stay exactly as they are today. These new tables
-- add project-level allocation and inter-project financing on top.
--
-- Phased delivery: this migration covers the FULL feature so it only
-- needs to be run once. The app code is being built in phases —
-- Phase 1 (this push) is Loan Allocations. Repayment settlement,
-- inter-project ledger UI, the audit log screen, and the dashboard
-- follow in later pushes, using these same tables.

-- ── 1. Loan allocations ─────────────────────────────────────────────
-- Splits a loan's principal across projects/overheads. Amount-based
-- (not %) since loans may be disbursed in tranches. Editing uses a
-- supersede pattern (close old row via effective_to + insert a new
-- one) rather than in-place mutation, so historical interest
-- calculations stay correct for the period each split was actually in
-- effect.
create table if not exists loan_allocations (
  id             uuid primary key default gen_random_uuid(),
  loan_id        uuid not null references loans(id),
  type           text not null check (type in ('OVERHEAD','PROJECT')),
  project_id     uuid references projects(id),           -- null when type = OVERHEAD
  amount         numeric not null check (amount > 0),
  effective_from date not null default current_date,
  effective_to   date,                                    -- null = currently active
  status         text not null default 'ACTIVE' check (status in ('ACTIVE','SUPERSEDED','DELETED')),
  version        int not null default 1,
  reason         text,                                    -- required in the app for EDIT/DELETE
  created_by     uuid,
  created_at     timestamptz default now()
);
create index if not exists idx_loan_alloc_loan    on loan_allocations(loan_id);
create index if not exists idx_loan_alloc_project on loan_allocations(project_id);
create index if not exists idx_loan_alloc_status  on loan_allocations(status);

-- ── 2. Loan repayments (project-allocation-aware) ───────────────────
-- Separate from the existing `loan_transactions` table (which keeps
-- serving the simpler company-level loan tracker unchanged). This one
-- exists specifically to record which project's cash funded a
-- repayment, and how it was split across every project the loan is
-- allocated to.
create table if not exists loan_repayments (
  id                   uuid primary key default gen_random_uuid(),
  loan_id              uuid not null references loans(id),
  date                 date not null default current_date,
  principal_paid       numeric not null default 0,
  interest_paid        numeric not null default 0,
  funded_by_project_id uuid references projects(id),      -- null = funded at company/overhead level
  split                jsonb,                              -- [{project_id, is_overhead, principal, interest}], the applied settlement
  status               text not null default 'ACTIVE' check (status in ('ACTIVE','DELETED')),
  reason               text,
  created_by           uuid,
  created_at           timestamptz default now()
);
create index if not exists idx_loan_repay_loan on loan_repayments(loan_id);

-- ── 3. Inter-project advances ────────────────────────────────────────
-- Auto-created for every non-funding project covered by a repayment:
-- the funding project effectively lent the beneficiary project its
-- share of that repayment, so it's tracked here as its own advance
-- with its own interest, until the beneficiary settles it back.
create table if not exists inter_project_advances (
  id                   uuid primary key default gen_random_uuid(),
  from_project_id      uuid not null references projects(id),   -- funder
  to_project_id        uuid not null references projects(id),   -- beneficiary
  source_loan_id       uuid references loans(id),
  source_repayment_id  uuid references loan_repayments(id),
  principal            numeric not null default 0,
  date                 date not null default current_date,
  interest_rate        numeric not null default 0,
  rate_source          text not null default 'SAME_AS_LOAN' check (rate_source in ('SAME_AS_LOAN','CUSTOM')),
  status               text not null default 'ACTIVE' check (status in ('ACTIVE','CLOSED','DELETED')),
  settled_principal    numeric not null default 0,
  settled_interest     numeric not null default 0,
  closed_date          date,
  reason               text,
  created_by           uuid,
  created_at           timestamptz default now()
);
create index if not exists idx_ipa_from on inter_project_advances(from_project_id);
create index if not exists idx_ipa_to   on inter_project_advances(to_project_id);
create index if not exists idx_ipa_loan on inter_project_advances(source_loan_id);

-- ── 4. Inter-project settlements ────────────────────────────────────
-- When a beneficiary project later pays the funding project back
-- (fully or partially).
create table if not exists inter_project_settlements (
  id              uuid primary key default gen_random_uuid(),
  advance_id      uuid not null references inter_project_advances(id),
  date            date not null default current_date,
  principal_paid  numeric not null default 0,
  interest_paid   numeric not null default 0,
  created_by      uuid,
  created_at      timestamptz default now()
);
create index if not exists idx_ips_advance on inter_project_settlements(advance_id);

-- ── 5. Audit log ─────────────────────────────────────────────────────
-- Generic trail for this module's transactional tables. Every edit or
-- delete on loan_allocations / loan_repayments / inter_project_advances
-- writes a row here from the app, including cascade_ids when one action
-- triggers downstream changes (e.g. deleting a repayment soft-deletes
-- the inter-project advances it spawned).
create table if not exists audit_log (
  id             uuid primary key default gen_random_uuid(),
  entity_name    text not null,
  entity_id      uuid not null,
  action         text not null check (action in ('CREATE','EDIT','DELETE')),
  field_changes  jsonb,
  reason         text,
  cascade_ids    jsonb,          -- [{entity_name, entity_id}, ...]
  performed_by   uuid,
  performed_at   timestamptz default now()
);
create index if not exists idx_audit_entity       on audit_log(entity_name, entity_id);
create index if not exists idx_audit_performed_at on audit_log(performed_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────
-- Permissive placeholders (matches the pattern used for
-- attendance_settings earlier) — tighten to match your existing
-- policy style if you use auth.uid()-based rules elsewhere.
alter table loan_allocations           enable row level security;
alter table loan_repayments            enable row level security;
alter table inter_project_advances     enable row level security;
alter table inter_project_settlements  enable row level security;
alter table audit_log                  enable row level security;

drop policy if exists "loan_allocations_all" on loan_allocations;
create policy "loan_allocations_all" on loan_allocations for all using (true) with check (true);

drop policy if exists "loan_repayments_all" on loan_repayments;
create policy "loan_repayments_all" on loan_repayments for all using (true) with check (true);

drop policy if exists "inter_project_advances_all" on inter_project_advances;
create policy "inter_project_advances_all" on inter_project_advances for all using (true) with check (true);

drop policy if exists "inter_project_settlements_all" on inter_project_settlements;
create policy "inter_project_settlements_all" on inter_project_settlements for all using (true) with check (true);

drop policy if exists "audit_log_all" on audit_log;
create policy "audit_log_all" on audit_log for all using (true) with check (true);

-- ── Realtime (optional but recommended, matches the pattern used for
--    Attendance) — lets the allocation panel and audit log update live
--    across sessions once that UI exists.
alter publication supabase_realtime add table public.loan_allocations;
alter publication supabase_realtime add table public.loan_repayments;
alter publication supabase_realtime add table public.inter_project_advances;
alter publication supabase_realtime add table public.audit_log;
