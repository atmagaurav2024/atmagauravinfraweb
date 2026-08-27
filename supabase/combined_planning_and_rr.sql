-- Combined Planning & Combined RR: true merged (one row = multiple BOQ
-- items) records, kept in separate new tables rather than altering
-- boq_exec_resources/resource_requisitions directly.
--
-- Why separate tables instead of changing the existing ones: those two
-- tables are the shared backbone for the ENTIRE execution pipeline -
-- Planning, RR, Work Allotment, and Execution all read/write them,
-- linked via boq_exec_resource_id chains (planned -> allotted ->
-- executed all reference each other's rows in the same table). Adding
-- "one row can cover multiple BOQ items" there would ripple through
-- all four stages at once and risk breaking real allotment/execution
-- tracking. These new tables let Combined Planning/RR genuinely merge
-- records without touching any of that existing, working logic.

-- ═══ Combined Planning ═══
-- One row = one subcontractor assignment covering multiple BOQ items.
create table if not exists combined_plan_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  party_name text not null,
  exec_type text not null default 'sc', -- vendor | sc | labour_contractor | labour | machinery
  rate_mode text not null default 'boq', -- 'boq' = each item's own BOQ rate, 'custom' = flat rate for all
  custom_rate numeric,
  resource_category text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists combined_plan_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references combined_plan_groups(id) on delete cascade,
  boq_item_id uuid not null references boq_items(id) on delete cascade,
  qty numeric not null,
  rate numeric not null default 0,
  unit text,
  jm_links jsonb, -- same shape as boq_exec_resources.jm_links: [{jm_id, plan_qty, jm_qty, jm_number}]
  created_at timestamptz not null default now()
);

create index if not exists idx_combined_plan_groups_project on combined_plan_groups(project_id);
create index if not exists idx_combined_plan_items_group on combined_plan_items(group_id);
create index if not exists idx_combined_plan_items_boq_item on combined_plan_items(boq_item_id);

-- ═══ Combined RR ═══
-- One row = one requisition document covering multiple BOQ items.
create table if not exists combined_rr_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  rr_number text not null,
  required_date date not null,
  remarks text,
  requested_by text,
  status text not null default 'pending', -- pending | approved | rejected | allotted
  created_at timestamptz not null default now()
);

create table if not exists combined_rr_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references combined_rr_groups(id) on delete cascade,
  boq_item_id uuid not null references boq_items(id) on delete cascade,
  plan_item_id uuid references combined_plan_items(id) on delete set null,
  party_name text not null,
  party_type text not null,
  qty numeric not null,
  unit text,
  created_at timestamptz not null default now()
);

create index if not exists idx_combined_rr_groups_project on combined_rr_groups(project_id);
create index if not exists idx_combined_rr_items_group on combined_rr_items(group_id);
create index if not exists idx_combined_rr_items_boq_item on combined_rr_items(boq_item_id);

-- RLS: match the pattern used by boq_exec_resources/resource_requisitions
-- (adjust if your existing policies differ from a simple company-scoped read/write)
alter table combined_plan_groups enable row level security;
alter table combined_plan_items enable row level security;
alter table combined_rr_groups enable row level security;
alter table combined_rr_items enable row level security;

create policy "combined_plan_groups_all" on combined_plan_groups for all using (true) with check (true);
create policy "combined_plan_items_all" on combined_plan_items for all using (true) with check (true);
create policy "combined_rr_groups_all" on combined_rr_groups for all using (true) with check (true);
create policy "combined_rr_items_all" on combined_rr_items for all using (true) with check (true);
