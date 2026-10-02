-- One-time repair for employees whose Supabase Auth account exists but
-- isn't linked back to their employees row (employees.auth_id is null,
-- or points at an id that no longer exists in auth.users).
--
-- Root cause (fixed in app code separately): the "Reset Password" and
-- "set password" flows in Employee Management call Supabase Auth's
-- /signup endpoint to create a login account, but never wrote the new
-- account's id back onto employees.auth_id. Login looks an employee up
-- by auth_id = auth.uid(); when nothing matches, the app silently falls
-- through to its "could be admin" fallback, so the employee ends up
-- looking logged in as "Admin" instead of themselves.
--
-- This can't be fixed from inside the app itself: current_company_id()
-- is defined as `select company_id from employees where auth_id =
-- auth.uid()`, and every company-scoped RLS policy requires
-- company_id = current_company_id() — so an employee whose auth_id
-- isn't linked yet can't even see their own employees row through the
-- app's own (anon-key) session. Run this once in the Supabase SQL editor
-- (which runs with elevated privileges, bypassing RLS) to relink them.
--
-- Safe to re-run: only ever fills in a null auth_id, never overwrites an
-- existing one, and only links an auth.users row that isn't already
-- claimed by a different employee.

do $$
declare
  r record;
  fixed_count int := 0;
  skipped_count int := 0;
  match_id uuid;
begin
  for r in
    select e.id, e.name, e.phone, e.company_id, c.slug
    from employees e
    join companies c on c.id = e.company_id
    where e.phone is not null and e.phone <> ''
      and (
        e.auth_id is null
        or not exists (select 1 from auth.users u where u.id = e.auth_id)
      )
  loop
    select u.id into match_id
    from auth.users u
    where u.email = regexp_replace(r.phone, '[^0-9]', '', 'g') || '@' || r.slug || '.rydax.internal'
    limit 1;

    if match_id is not null
       and not exists (select 1 from employees e2 where e2.auth_id = match_id and e2.id <> r.id)
    then
      update employees set auth_id = match_id where id = r.id;
      fixed_count := fixed_count + 1;
      raise notice 'Linked: % (phone %) -> auth user %', r.name, r.phone, match_id;
    else
      skipped_count := skipped_count + 1;
      raise notice 'No match found, left as-is: % (phone %, company %) — this employee likely never had Reset Password / a login account set up at all', r.name, r.phone, r.slug;
    end if;
  end loop;

  raise notice '--- Done: % relinked, % skipped (no matching auth account found) ---', fixed_count, skipped_count;
end $$;

-- Verify: should return zero rows once everyone who has a real auth
-- account is relinked. Any remaining rows are employees who need a
-- fresh password set via the app's "Reset Password" (now fixed to link
-- correctly going forward).
select e.id, e.name, e.phone, c.slug
from employees e
join companies c on c.id = e.company_id
where e.phone is not null and e.phone <> ''
  and (
    e.auth_id is null
    or not exists (select 1 from auth.users u where u.id = e.auth_id)
  );
