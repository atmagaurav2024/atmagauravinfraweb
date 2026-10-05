-- "Close project for Entry": a closed project is hidden from every project
-- dropdown where new entries are made (petty cash, employee assignment,
-- loan allocation, asset assignment, ...). Existing records are untouched.
-- Run once in Supabase → SQL Editor.

alter table projects add column if not exists closed_for_entry boolean not null default false;

NOTIFY pgrst, 'reload schema';
