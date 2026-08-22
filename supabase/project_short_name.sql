-- Adds a "Short Name" field to projects (e.g. "NH-161G" alongside the
-- full "Construction of Overhead Pedestrian Bridge at Hiwra Ashram
-- in Ch. 12.900..." name) — useful for compact display on cards,
-- dashboard widgets, and anywhere the full name would be too long.
-- Run once in Supabase → SQL Editor.

alter table projects add column if not exists short_name text;

NOTIFY pgrst, 'reload schema';
