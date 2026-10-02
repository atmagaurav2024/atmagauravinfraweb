-- Diagnostic for the employees that the backfill script could NOT relink
-- (the ones still showing in its final SELECT). For each, this shows the
-- exact email it searched for, and any auth.users row that looks close
-- but didn't match exactly — a mismatch here almost always means the
-- phone digits or the company slug drifted between when the login
-- account was created and now (e.g. employee's phone number was edited
-- afterwards, or they were moved to a different company).
--
-- Run this in the Supabase SQL editor and share the results.

select
  e.id as employee_id,
  trim(coalesce(e.first_name,'') || ' ' || coalesce(e.last_name,'')) as employee_name,
  e.phone as phone_on_employee_record,
  e.auth_id as current_auth_id,
  c.slug as company_slug,
  regexp_replace(e.phone, '[^0-9]', '', 'g') || '@' || c.slug || '.rydax.internal' as expected_email,
  (
    select string_agg(u.email || '  (id=' || u.id || ')', ' | ')
    from auth.users u
    where u.email ilike '%' || regexp_replace(e.phone, '[^0-9]', '', 'g') || '%'
  ) as closest_auth_users_matches
from employees e
join companies c on c.id = e.company_id
where e.phone is not null and e.phone <> ''
  and (
    e.auth_id is null
    or not exists (select 1 from auth.users u2 where u2.id = e.auth_id)
  );
