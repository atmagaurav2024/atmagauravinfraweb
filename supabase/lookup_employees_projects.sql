-- Read-only lookup — changes nothing, only SELECTs.
--
-- IMPORTANT: run each numbered block BY ITSELF (highlight just that
-- block's text and run it, or run one, clear the editor, paste the
-- next). Supabase's SQL editor only shows the result of the LAST
-- statement it ran — if you run this whole file in one go, you'll
-- only ever see block 4's result, never 1-3, which is almost
-- certainly why nothing seemed to show up last time.

-- ── BLOCK 1: sanity check — how many rows actually exist? ──────────
-- If either number is 0, that's the real problem (empty table, or
-- you're on a different company than you expect), and blocks 3/4
-- will correctly come back empty too — not a bug in the query.
select
  (select count(*) from employees) as employee_count,
  (select count(*) from projects) as project_count;

-- ── BLOCK 2: which company/companies is this data under? ───────────
select id as company_id, name, slug from companies order by name;

-- ── BLOCK 3: all employees, as one copyable JSON cell ───────────────
select coalesce(json_agg(row_to_json(t)), '[]'::json) as employees_json
from (
  select e.id as employee_uuid, e.emp_id as employee_code,
         trim(coalesce(e.first_name,'')||' '||coalesce(e.middle_name,'')||' '||coalesce(e.last_name,'')) as full_name,
         e.designation, e.role, e.status, e.company_id
  from employees e
  order by full_name
) t;

-- ── BLOCK 4: all projects, as one copyable JSON cell ─────────────────
select coalesce(json_agg(row_to_json(t)), '[]'::json) as projects_json
from (
  select p.* from projects p order by p.name
) t;
