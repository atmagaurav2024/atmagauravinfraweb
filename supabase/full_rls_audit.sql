-- Full RLS audit: every table in the public schema (not just the 51 I
-- already know about), whether RLS is even enabled, how many policies
-- it has, and whether any of those policies are still fully
-- permissive (using=true or with_check=true) — the exact bug pattern
-- that caused the earlier cross-tenant leak, in case anything else
-- has it. One copyable text cell, one line per table.

select string_agg(
  t.tablename ||
  ' | rls=' || c.relrowsecurity::text ||
  ' | policies=' || coalesce(p.policy_count, 0)::text ||
  ' | names=[' || coalesce(p.policy_names, 'NONE') || ']' ||
  case when p.has_permissive_true then ' | ⚠ STILL PERMISSIVE' else '' end,
  E'\n'
  order by
    case when not c.relrowsecurity then 0 else 1 end,  -- no-RLS tables first
    case when p.policy_count is null or p.policy_count = 0 then 0 else 1 end,
    t.tablename
) as result
from pg_tables t
join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
left join (
  select
    tablename,
    count(*) as policy_count,
    string_agg(policyname, ', ') as policy_names,
    bool_or(qual = 'true' or with_check = 'true') as has_permissive_true
  from pg_policies
  where schemaname = 'public'
  group by tablename
) p on p.tablename = t.tablename
where t.schemaname = 'public'
order by 1;
