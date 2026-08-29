-- Subcontract Schedule B/H: mirrors the existing Schedule B (scope +
-- qty/unit) + Schedule H (% allocation) pattern used for the main
-- contract, but scoped to an individual subcontract with its own
-- value instead of the project's overall Contract Price. A scope can
-- combine multiple BOQ items under one named scope of work.

create table if not exists subcontracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  party_name text not null,
  subcontract_value numeric not null default 0,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists subcontract_scopes (
  id uuid primary key default gen_random_uuid(),
  subcontract_id uuid not null references subcontracts(id) on delete cascade,
  scope_name text not null,
  scope_qty numeric not null,
  scope_unit text,
  percentage numeric not null, -- % of the subcontract's value, not the project CP
  created_at timestamptz not null default now()
);

create table if not exists subcontract_scope_items (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references subcontract_scopes(id) on delete cascade,
  boq_item_id uuid not null references boq_items(id) on delete cascade
);

create table if not exists subcontract_scope_progress (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references subcontract_scopes(id) on delete cascade,
  completed_qty numeric not null,
  date date not null,
  remarks text,
  rate_used numeric not null, -- the derived per-unit rate at the time this entry was logged
  amount numeric not null,    -- completed_qty * rate_used, i.e. what this entry billed
  work_bill_id uuid references work_bills(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_subcontracts_project on subcontracts(project_id);
create index if not exists idx_subcontract_scopes_subcontract on subcontract_scopes(subcontract_id);
create index if not exists idx_subcontract_scope_items_scope on subcontract_scope_items(scope_id);
create index if not exists idx_subcontract_scope_items_boq_item on subcontract_scope_items(boq_item_id);
create index if not exists idx_subcontract_scope_progress_scope on subcontract_scope_progress(scope_id);

alter table subcontracts enable row level security;
alter table subcontract_scopes enable row level security;
alter table subcontract_scope_items enable row level security;
alter table subcontract_scope_progress enable row level security;

-- Adjust these to match your existing tables' RLS if different
create policy "subcontracts_all" on subcontracts for all using (true) with check (true);
create policy "subcontract_scopes_all" on subcontract_scopes for all using (true) with check (true);
create policy "subcontract_scope_items_all" on subcontract_scope_items for all using (true) with check (true);
create policy "subcontract_scope_progress_all" on subcontract_scope_progress for all using (true) with check (true);
