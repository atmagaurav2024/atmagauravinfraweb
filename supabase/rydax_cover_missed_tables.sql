-- Rydax multi-tenancy — cover the tables the original migration missed
-- Run once in Supabase → SQL Editor.
--
-- The full RLS audit found 20 real tables still fully permissive,
-- never touched by the original migration: accounts, bill_payments,
-- bills, boq_execution, daily_progress, departments, gst_entries,
-- hr_orders, jm_records, labour, letter_numbers, petty_cash_expense,
-- project_activities, punch_logs, salary_increments,
-- show_cause_notices, tds_entries, voucher_items, work_allotments.
--
-- These weren't in the original 51-table list because that list was
-- built by grepping literal string table names in sbFetch/sbInsert/
-- sbUpdate/sbDelete calls — anything referenced with a dynamic
-- variable instead of a literal string, or genuinely no longer
-- referenced anywhere in the current codebase (several of these look
-- like superseded duplicates of tables that ARE covered — e.g.
-- "labour" vs "labourers", "petty_cash_expense" vs
-- "petty_cash_expenses" — likely earlier-generation table names left
-- behind when the feature was rebuilt under a new name), wouldn't
-- have been caught. Rather than spend more time determining exactly
-- which of these are truly dead, this closes all of them the same
-- way — harmless if a table turns out to be unused, and closes a real
-- gap if any of them are secretly still live.
--
-- (companies is deliberately excluded — its "permissive" flag from the
-- audit is a false positive: companies_signup_insert's with_check=true
-- is intentional, since anyone must be able to create a brand-new
-- company. Nothing to fix there.)

do $$
declare
  t text;
  p record;
  tenant_zero uuid;
  tables text[] := array[
    'accounts','bill_payments','bills','boq_execution','daily_progress',
    'departments','gst_entries','hr_orders','jm_records','labour',
    'letter_numbers','petty_cash_expense','project_activities',
    'punch_logs','salary_increments','show_cause_notices','tds_entries',
    'voucher_items','work_allotments'
  ];
begin
  select id into tenant_zero from companies order by created_at asc limit 1;

  foreach t in array tables loop
    if to_regclass('public.'||t) is null then
      raise notice 'Skipping % — table does not exist in this database', t;
      continue;
    end if;

    -- company_id column + backfill + default + index
    execute format('alter table %I add column if not exists company_id uuid references companies(id)', t);
    execute format('update %I set company_id = %L where company_id is null', t, tenant_zero);
    execute format('alter table %I alter column company_id set default current_company_id()', t);
    execute format('create index if not exists %I on %I(company_id)', 'idx_'||t||'_company', t);

    -- Drop every existing policy on this table, whatever it's named —
    -- same lesson as the earlier cross-tenant leak fix: guessing names
    -- leaves old permissive policies alive to combine via OR.
    for p in select policyname from pg_policies where tablename = t loop
      execute format('drop policy %I on %I', p.policyname, t);
    end loop;

    execute format('alter table %I enable row level security', t);
    execute format($f$
      create policy %I on %I for all
      using (company_id = current_company_id())
      with check (company_id = current_company_id())
    $f$, t||'_tenant_isolated', t);
  end loop;
end $$;

-- Verify — every table listed above should now show exactly 1 policy
-- and no permissive flag.
select string_agg(
  tablename || ': ' || policy_count ||
  case when has_permissive_true then ' ⚠ STILL PERMISSIVE' else ' ok' end,
  E'\n'
  order by tablename
) as result
from (
  select tablename, count(*) as policy_count,
    bool_or(qual = 'true' or with_check = 'true') as has_permissive_true
  from pg_policies
  where tablename in (
    'accounts','bill_payments','bills','boq_execution','daily_progress',
    'departments','gst_entries','hr_orders','jm_records','labour',
    'letter_numbers','petty_cash_expense','project_activities',
    'punch_logs','salary_increments','show_cause_notices','tds_entries',
    'voucher_items','work_allotments'
  )
  group by tablename
) x;
