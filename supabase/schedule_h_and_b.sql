-- Schedule H & Schedule B for EPC projects
-- Run once in Supabase → SQL Editor.
--
-- Schedule H: a hierarchical breakdown of the Contract Price into
-- components and sub-components, each carrying a % of Contract Price
-- used for milestone-based billing (e.g. Highway Work = 60% of CP,
-- with Subgrade 15% / GSB 15% / DLC 10% / PQC 20% underneath it,
-- summing back to that 60%).
--
-- Schedule B: scope-of-work items, each optionally linked to a
-- Schedule H component so the scope description ties back to which
-- billing component it belongs to.

create table if not exists schedule_h (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid references companies(id),
  project_id     uuid not null references projects(id) on delete cascade,
  parent_id      uuid references schedule_h(id) on delete cascade,  -- null = top-level component
  component_name text not null,
  percentage     numeric not null,   -- % of the project's Contract Price
  sort_order     int default 0,
  created_at     timestamptz default now()
);
create index if not exists idx_schedule_h_project on schedule_h(project_id);
create index if not exists idx_schedule_h_parent on schedule_h(parent_id);

create table if not exists schedule_b (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid references companies(id),
  project_id            uuid not null references projects(id) on delete cascade,
  scope_description     text not null,
  linked_schedule_h_id  uuid references schedule_h(id) on delete set null,
  sort_order            int default 0,
  created_at            timestamptz default now()
);
create index if not exists idx_schedule_b_project on schedule_b(project_id);

-- Tenant isolation — same pattern as every other table in the app.
do $$
declare
  t text;
  tenant_zero uuid;
begin
  select id into tenant_zero from companies order by created_at asc limit 1;

  foreach t in array array['schedule_h','schedule_b'] loop
    execute format('update %I set company_id = %L where company_id is null', t, tenant_zero);
    execute format('alter table %I alter column company_id set default current_company_id()', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_tenant_isolated', t);
    execute format($f$
      create policy %I on %I for all
      using (company_id = current_company_id())
      with check (company_id = current_company_id())
    $f$, t||'_tenant_isolated', t);
  end loop;
end $$;
