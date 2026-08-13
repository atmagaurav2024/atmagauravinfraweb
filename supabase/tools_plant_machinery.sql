-- Tools, Plant & Machinery module — required one-time migration
-- Run once in Supabase → SQL Editor.

-- 1. Asset register
create table if not exists tpm_assets (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  category           text not null default 'Other',       -- Heavy Machinery, Vehicles, Tools, Site Equipment, Safety Equipment, Other
  make_model         text,
  reg_or_serial_no   text,
  purchase_date      date,
  purchase_cost      numeric default 0,
  ownership          text not null default 'owned',        -- owned, rented_in
  vendor_name        text,                                  -- set when ownership = rented_in
  status             text not null default 'available',     -- available, in_use, maintenance, breakdown, disposed
  current_project_id uuid references projects(id),
  notes              text,
  created_by         uuid,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists idx_tpm_assets_status  on tpm_assets(status);
create index if not exists idx_tpm_assets_project on tpm_assets(current_project_id);

-- 2. Assignment/transfer history — every move between projects (or to/from
--    the yard, i.e. no project) is logged here, in addition to the
--    asset's own current_project_id reflecting where it is right now.
create table if not exists tpm_transfers (
  id              uuid primary key default gen_random_uuid(),
  tpm_id          uuid not null references tpm_assets(id),
  from_project_id uuid references projects(id),
  to_project_id   uuid references projects(id),
  date            date not null default current_date,
  remarks         text,
  created_by      uuid,
  created_at      timestamptz default now()
);
create index if not exists idx_tpm_transfers_asset on tpm_transfers(tpm_id);

-- ── RLS (permissive placeholders, matching the pattern used elsewhere —
--    tighten to match your existing policy style if needed) ───────────
alter table tpm_assets    enable row level security;
alter table tpm_transfers enable row level security;

drop policy if exists "tpm_assets_all" on tpm_assets;
create policy "tpm_assets_all" on tpm_assets for all using (true) with check (true);

drop policy if exists "tpm_transfers_all" on tpm_transfers;
create policy "tpm_transfers_all" on tpm_transfers for all using (true) with check (true);

-- ── Realtime (optional, matches the Attendance/Access Control pattern) ──
alter publication supabase_realtime add table public.tpm_assets;
alter publication supabase_realtime add table public.tpm_transfers;
