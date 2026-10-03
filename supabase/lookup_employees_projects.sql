-- Read-only lookup — run this in the Supabase SQL editor and share the
-- results back (copy/paste the output, or export as CSV). It's used to
-- build the real Petty Cash import script with exact IDs instead of
-- guessing employee/project names via ILIKE.
-- Nothing is changed by this script — both queries are plain SELECTs.

-- Your active employees: name, employee code, and which company they
-- belong to (useful if your account has more than one company).
select e.id as employee_uuid, e.emp_id as employee_code,
       trim(coalesce(e.first_name,'')||' '||coalesce(e.middle_name,'')||' '||coalesce(e.last_name,'')) as full_name,
       e.designation, e.role, e.status, e.company_id, c.slug as company_slug
from employees e
join companies c on c.id = e.company_id
order by c.slug, full_name;

-- Your projects: name and id, so site names from the old Excel file can
-- be matched to the exact project record instead of a name guess.
select p.id as project_uuid, p.name as project_name, p.company_id, c.slug as company_slug,
       p.contract_value, p.address
from projects p
join companies c on c.id = p.company_id
order by c.slug, project_name;
