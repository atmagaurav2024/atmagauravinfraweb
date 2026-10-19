-- =====================================================================
-- Rename employee IDs and project codes that start with RYDAX- to this
-- company's own prefix (AIPL-). Run once in Supabase -> SQL Editor.
--
-- * Employees: RYDAX-001 -> next free AIPL-nnn (numbering continues after
--   the highest AIPL number already in use).
-- * Every table that stores that employee ID (petty cash, attendance,
--   salary, advances, ...) is updated too, so nothing is orphaned.
-- * Projects: RYDAX-001 -> AIPL-001 (same number).
-- SAFE: one block, all-or-nothing; running it again does nothing.
-- =====================================================================
do $$
declare
  v_co    uuid := 'd8860938-2700-4505-bf73-6e0278760c07';
  v_pref  text := 'AIPL';
  v_max   int;
  v_new   text;
  r       record;
  t       record;
  n_emp   int := 0;
begin
  select coalesce(max((regexp_match(upper(emp_id),'^'||v_pref||'-(\d+)$'))[1]::int),0)
    into v_max from employees where company_id = v_co;

  for r in select emp_id from employees
            where company_id = v_co and upper(emp_id) like 'RYDAX-%'
            order by created_at loop
    v_max := v_max + 1;
    v_new := v_pref || '-' || lpad(v_max::text, 3, '0');

    update employees
       set emp_id = v_new,
           badge_no = case when badge_no = r.emp_id then v_new else badge_no end
     where company_id = v_co and emp_id = r.emp_id;

    for t in
      select c.table_name
        from information_schema.columns c
        join information_schema.tables tb
          on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
       where c.table_schema = 'public' and c.column_name = 'emp_id'
         and c.table_name <> 'employees'
         and c.data_type in ('text','character varying')
         and exists (select 1 from information_schema.columns c2
                      where c2.table_schema = 'public' and c2.table_name = c.table_name and c2.column_name = 'company_id')
    loop
      execute format('update %I set emp_id = $1 where emp_id = $2 and company_id = $3', t.table_name)
        using v_new, r.emp_id, v_co;
    end loop;
    n_emp := n_emp + 1;
  end loop;

  update projects set code = v_pref || '-' || substr(code, 7)
   where company_id = v_co and upper(code) like 'RYDAX-%';

  raise notice 'Renamed % employee(s).', n_emp;
end $$;

-- check
select emp_id, first_name, last_name from employees order by emp_id;
select code, name from projects order by code;
