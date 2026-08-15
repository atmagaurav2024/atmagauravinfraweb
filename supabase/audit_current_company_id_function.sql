-- Confirms current_company_id() is genuinely SECURITY DEFINER (the fix
-- for the earlier infinite-recursion bug) and shows its owner — a
-- SECURITY DEFINER function runs with its *owner's* privileges, so the
-- owner should be a trusted role (postgres, or whoever created it),
-- not something a lower-privileged role could hijack by redefining.

select string_agg(
  p.proname || ' | security_definer=' || p.prosecdef::text || ' | owner=' || r.rolname || ' | volatility=' || p.provolatile::text,
  E'\n'
) as result
from pg_proc p
join pg_roles r on r.oid = p.proowner
where p.proname = 'current_company_id';
