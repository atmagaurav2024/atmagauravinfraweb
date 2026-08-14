-- Rydax multi-tenancy — fix existing logins
-- Run once in Supabase → SQL Editor, AFTER rydax_multitenancy_phase1.sql.
--
-- Your existing accounts were created in Supabase Auth with email
-- <phone>@aipl.internal. The new login flow (company code + phone +
-- password) now authenticates against <phone>@<company-slug>.rydax
-- .internal instead — a different email, so Supabase Auth can't find
-- a match for anyone who signed up before this migration. This
-- updates every existing user's email to the new format so their
-- existing password keeps working unchanged; nothing about their
-- password itself is touched.
--
-- Safe to re-run — only updates rows whose email still ends in
-- @aipl.internal, so already-migrated users are left alone.

do $$
declare
  tenant_zero_slug text;
  r record;
begin
  select slug into tenant_zero_slug from companies order by created_at asc limit 1;

  for r in
    select e.auth_id, e.phone
    from employees e
    where e.auth_id is not null and e.phone is not null and e.phone <> ''
  loop
    update auth.users
    set email = regexp_replace(r.phone, '[^0-9]', '', 'g') || '@' || tenant_zero_slug || '.rydax.internal'
    where id = r.auth_id
      and email like '%@aipl.internal';
  end loop;
end $$;

-- Verify: should return zero rows once done. If any remain, their
-- employees.auth_id likely doesn't match an actual auth.users row, or
-- their phone number is empty/null — worth checking those individually.
select u.id, u.email
from auth.users u
where u.email like '%@aipl.internal';
