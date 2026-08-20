-- App-wide activity log — records every create/update/delete action
-- across the app, with who did it and when. Run once in Supabase →
-- SQL Editor.
--
-- Named app_activity_log, NOT audit_log — a table called audit_log
-- already exists, built earlier for the Loans module's cascade-delete
-- tracking (entity_name/entity_id/field_changes/reason/cascade_ids/
-- performed_by/performed_at — see lnAuditWrite() in index.html). That
-- table is actively used and must not be touched or repurposed; if
-- this app-wide log had reused its name, "create table if not exists"
-- would have silently done nothing (the table already existed under
-- that name), and every insert here would have failed on that other
-- table's required entity_name column — which is exactly what
-- happened before this got renamed.
--
-- Populated automatically by the app (see sbInsert/sbUpdate/sbDelete
-- in index.html, which all log through this centrally rather than
-- each of the app's hundreds of individual save/delete functions
-- needing to be instrumented separately).

create table if not exists app_activity_log (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references companies(id),
  user_id     uuid,        -- employees.id of who performed the action (not auth.users id)
  user_name   text,        -- denormalized so the log stays readable even if the employee is later deleted
  action      text not null,   -- 'create' | 'update' | 'delete'
  table_name  text not null,
  record_id   text,
  changes     jsonb,       -- create: the new row; update: the fields that were sent; delete: just the id
  created_at  timestamptz default now()
);

create index if not exists idx_app_activity_log_company_date on app_activity_log(company_id, created_at desc);
create index if not exists idx_app_activity_log_table on app_activity_log(table_name);
create index if not exists idx_app_activity_log_user on app_activity_log(user_id);

alter table app_activity_log enable row level security;
drop policy if exists app_activity_log_tenant_isolated on app_activity_log;
create policy app_activity_log_tenant_isolated on app_activity_log for all
  using (company_id = current_company_id())
  with check (company_id = current_company_id());

NOTIFY pgrst, 'reload schema';

-- Cleanup: earlier troubleshooting (before this collision was
-- understood) added company_id/user_id/user_name/changes columns
-- directly onto the pre-existing audit_log table via ALTER TABLE,
-- trying to fix what looked like a missing column. Those don't belong
-- on the Loans module's audit_log and were never used by it - this
-- removes them, restoring that table to its original, correct shape
-- (entity_name/entity_id/action/field_changes/reason/cascade_ids/
-- performed_by/performed_at). Safe to run even if some or none of
-- these were actually added.
alter table audit_log drop column if exists company_id;
alter table audit_log drop column if exists user_id;
alter table audit_log drop column if exists user_name;
alter table audit_log drop column if exists changes;

NOTIFY pgrst, 'reload schema';
