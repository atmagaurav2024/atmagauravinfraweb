select string_agg(
  tablename || ': ' || policy_count || ' [' || names || ']',
  E'\n'
  order by tablename
) as result
from (
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
) x;
