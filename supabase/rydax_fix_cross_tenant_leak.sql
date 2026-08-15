-- Rydax multi-tenancy — fix cross-tenant data leak
-- Run once in Supabase → SQL Editor.
--
-- Root cause: the original migration only dropped policies named
-- exactly "<table>_all" or "<table>_tenant_isolated" before creating
-- the new tenant-isolated one. That's fine for tables whose RLS was
-- set up earlier this session (loans, TPM, allocations, etc. — those
-- really were named "<table>_all"). But core tables that existed
-- *before* this session (employees, projects, attendance, vouchers,
-- chart_of_accounts, and others) already had their own RLS policies
-- with different names, set up whenever they were first built. Those
-- were never actually dropped.
--
-- Postgres combines multiple permissive policies with OR — so if an
-- old "using (true)" policy was still active on employees alongside
-- the new tenant-isolated one, every row satisfies the old policy
-- regardless of the new one, and every company can see every other
-- company's data. This is very likely what you're seeing: the new
-- company's admin seeing the original company's projects/employees/
-- company_details, because those tables' original policies were
-- never removed.
--
-- This drops EVERY existing policy on each table (found dynamically
-- by name, not guessed) before creating the one tenant-isolated
-- policy that should be the only one left.

do $$
declare
  t text;
  p record;
  tables text[] := array[
    'access_permissions','advance_recoveries','attendance','attendance_punches',
    'attendance_settings','audit_log','boq_exec_resources','boq_items','boq_jm',
    'boq_subitems','categories','chart_of_accounts','company_details',
    'company_expenses','employee_advances','employee_leave_fixation',
    'employee_orders','employee_pay','employees','equipment','grn_entries',
    'inter_project_advances','inter_project_settlements','labourers',
    'leave_requests','loan_allocations','loan_parties','loan_repayments',
    'loan_transactions','loans','materials','other_expenses',
    'petty_cash_expenses','petty_cash_in','projects','resource_requisitions',
    'salary_records','sales_bills','sales_payments','store_inventory',
    'store_issue_log','subcontractors','tpm_assets','tpm_transfers',
    'vendor_material_rates','vendors','vouchers','work_advances','work_bills',
    'work_daily_progress','work_orders','work_payments'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.'||t) is null then
      raise notice 'Skipping % — table does not exist in this database', t;
      continue;
    end if;

    -- Drop every policy actually on this table, whatever it's named
    for p in select policyname from pg_policies where tablename = t loop
      execute format('drop policy %I on %I', p.policyname, t);
    end loop;

    -- Recreate the one tenant-isolated policy that should be the only one
    execute format($f$
      create policy %I on %I for all
      using (company_id = current_company_id())
      with check (company_id = current_company_id())
    $f$, t||'_tenant_isolated', t);
  end loop;
end $$;

-- companies itself keeps its own two policies (own-row select,
-- signup insert) — re-affirm just in case either got tangled up too.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where tablename = 'companies' loop
    execute format('drop policy %I on companies', p.policyname);
  end loop;
end $$;

create policy "companies_own_row" on companies for select
  using (id = current_company_id());
create policy "companies_signup_insert" on companies for insert
  with check (true);

-- employees also needs its signup-insert policy re-affirmed, since the
-- loop above replaced it with the generic tenant-isolated one only —
-- without this, self-service company signup and self-registration
-- (both anonymous inserts) would stop working again.
drop policy if exists "employees_signup_insert" on employees;
create policy "employees_signup_insert" on employees for insert
  with check (
    status = 'pending'
    or (
      role = 'admin'
      and not exists (
        select 1 from employees e2
        where e2.company_id = employees.company_id and e2.role = 'admin'
      )
    )
  );

-- Verify: every table above should show exactly ONE policy now
-- (employees will correctly show two — tenant_isolated + signup_insert).
select tablename, count(*) as policy_count, string_agg(policyname, ', ') as names
from pg_policies
where tablename in (
  'access_permissions','advance_recoveries','attendance','attendance_punches',
  'attendance_settings','audit_log','boq_exec_resources','boq_items','boq_jm',
  'boq_subitems','categories','chart_of_accounts','company_details',
  'company_expenses','employee_advances','employee_leave_fixation',
  'employee_orders','employee_pay','employees','equipment','grn_entries',
  'inter_project_advances','inter_project_settlements','labourers',
  'leave_requests','loan_allocations','loan_parties','loan_repayments',
  'loan_transactions','loans','materials','other_expenses',
  'petty_cash_expenses','petty_cash_in','projects','resource_requisitions',
  'salary_records','sales_bills','sales_payments','store_inventory',
  'store_issue_log','subcontractors','tpm_assets','tpm_transfers',
  'vendor_material_rates','vendors','vouchers','work_advances','work_bills',
  'work_daily_progress','work_orders','work_payments','companies'
)
group by tablename
order by tablename;
