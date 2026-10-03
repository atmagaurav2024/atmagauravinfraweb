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

-- ── BLOCK 4 (try this first): simplest possible version — no JSON, no
-- aggregation, nothing fancy. If even this "doesn't work", the problem
-- isn't the query shape, it's something else (worth telling me exactly
-- what you see: a red error banner? a spinner that never finishes? an
-- empty grid with "0 rows"? each means something different).
select id, name from projects order by name;

-- ── BLOCK 4b: same thing as one copyable JSON cell. Only specific,
-- known-safe columns (id/name/contract_value — exactly what the app's
-- own code reads from this table), not "select *": a project row may
-- carry a large field (an attached document, etc.) that "select *"
-- would try to pull in and serialize too, same as the Excel file's
-- Photo column earlier — worth ruling out as the actual cause of
-- block 4's original version going nowhere.
select coalesce(json_agg(row_to_json(t)), '[]'::json) as projects_json
from (
  select p.id as project_uuid, p.name as project_name, p.contract_value
  from projects p
  order by p.name
) t;
