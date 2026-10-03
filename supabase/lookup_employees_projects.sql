-- Read-only lookup — run this in the Supabase SQL editor and share the
-- results back. It's used to build the real Petty Cash import script
-- with exact IDs instead of guessing employee/project names via ILIKE.
-- Nothing is changed by this script — both queries are plain SELECTs.
--
-- Each query below returns a SINGLE ROW with a SINGLE CELL containing
-- the whole result as one JSON array of text — so instead of a grid
-- you have to copy row by row, there's exactly one cell to click and
-- copy, with everything in it. Paste that whole cell's text back.

-- Your active employees: name, employee code, and which company they
-- belong to (useful if your account has more than one company).
select json_agg(row_to_json(t)) as employees_json
from (
  select e.id as employee_uuid, e.emp_id as employee_code,
         trim(coalesce(e.first_name,'')||' '||coalesce(e.middle_name,'')||' '||coalesce(e.last_name,'')) as full_name,
         e.designation, e.role, e.status, e.company_id, c.slug as company_slug
  from employees e
  join companies c on c.id = e.company_id
  order by c.slug, full_name
) t;

-- Your projects: every column, so site names from the old Excel file
-- can be matched to the exact project record instead of a name guess.
select json_agg(row_to_json(t)) as projects_json
from (
  select p.*, c.slug as company_slug
  from projects p
  join companies c on c.id = p.company_id
  order by c.slug, p.name
) t;
