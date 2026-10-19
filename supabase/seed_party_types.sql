-- OPTIONAL one-time setup: adds the five party types your existing allotments
-- already use, to Master Registry -> Party Types (so they appear in the
-- Party Type dropdown). You can rename, switch off, or add more there later.
-- Existing allotments keep working either way; only the dropdown list needs it.
insert into categories (company_id, type, name, icon, description, color, active)
select e.company_id, 'partytype', v.name, '', v.descr, '#37474F', true
from (select company_id from employees where emp_id = 'AIPL-001' limit 1) e
cross join (values
  ('Subcontractor',     'src:sc|key:sc'),
  ('Vendor',            'src:vendor|key:vendor'),
  ('Labour Contractor', 'src:sc|key:labour_contractor'),
  ('Labour',            'src:labour|key:labour'),
  ('Machinery',         'src:machinery|key:machinery')
) as v(name, descr)
where not exists (
  select 1 from categories c
  where c.company_id = e.company_id and c.type = 'partytype' and c.name = v.name
);
