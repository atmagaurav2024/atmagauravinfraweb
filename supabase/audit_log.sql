-- Audit log — records every create/update/delete action across the
-- app, with who did it and when. Run once in Supabase → SQL Editor.
--
-- Populated automatically by the app (see sbInsert/sbUpdate/sbDelete
-- in index.html, which all log through this centrally rather than
-- each of the app's hundreds of individual save/delete functions
-- needing to be instrumented separately).

create table if not exists audit_log (
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

create index if not exists idx_audit_log_company_date on audit_log(company_id, created_at desc);
create index if not exists idx_audit_log_table on audit_log(table_name);
create index if not exists idx_audit_log_user on audit_log(user_id);

alter table audit_log enable row level security;
drop policy if exists audit_log_tenant_isolated on audit_log;
create policy audit_log_tenant_isolated on audit_log for all
  using (company_id = current_company_id())
  with check (company_id = current_company_id());
