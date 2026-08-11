-- Geofenced attendance — required one-time migration
-- Run this once in Supabase → SQL Editor. The app code already handles
-- these columns/table being absent (falls back to "unrestricted", i.e.
-- punches record immediately like before), but geofencing and the
-- Pending Punches approval flow won't work until this is applied.

-- 1. New columns on attendance_punches: which project a punch matched
--    (or was nearest to), its approval status, and the computed distance.
alter table attendance_punches
  add column if not exists project_id  uuid references projects(id),
  add column if not exists status      text not null default 'approved',
  add column if not exists distance_m  numeric,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz;

-- 2. Single-row settings table holding the geofence radius (metres).
create table if not exists attendance_settings (
  id                 int primary key default 1,
  geofence_radius_m  integer not null default 200,
  updated_by         uuid,
  updated_at         timestamptz default now()
);
insert into attendance_settings (id, geofence_radius_m)
  values (1, 200)
  on conflict (id) do nothing;

-- 3. Row Level Security — adjust to match whatever policy style your
--    other tables use (these are permissive placeholders: any signed-in
--    user can read/update). If your other tables use auth.uid()-based
--    policies instead, copy that pattern here for consistency.
alter table attendance_settings enable row level security;

drop policy if exists "attendance_settings_read" on attendance_settings;
create policy "attendance_settings_read" on attendance_settings
  for select using (true);

drop policy if exists "attendance_settings_write" on attendance_settings;
create policy "attendance_settings_write" on attendance_settings
  for update using (true);
