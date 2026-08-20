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
-- understood) added user_id/user_name/changes columns directly onto
-- the pre-existing audit_log table, trying to fix what looked like a
-- missing column. None of these were ever used by the Loans module's
-- lnAuditWrite()/LN_AUDIT_LOG (which uses entity_name/entity_id/
-- action/field_changes/reason/cascade_ids/performed_by), so they're
-- confidently safe to remove.
--
-- Deliberately NOT touching company_id or its RLS policy here, even
-- though they were also added during that same troubleshooting -
-- this app went through an earlier, separate multi-tenancy migration
-- that added company_id + RLS to many existing tables, and there's no
-- way to confirm from here whether audit_log predates that and was
-- already tenant-isolated before any of this session's changes.
-- Getting that wrong risks either leaving a real tenant-isolation gap
-- or breaking it outright - safer to leave both alone than guess.
alter table audit_log drop column if exists user_id;
alter table audit_log drop column if exists user_name;
alter table audit_log drop column if exists changes;

NOTIFY pgrst, 'reload schema';
