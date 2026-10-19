-- =====================================================================
-- Lets an ADMIN set another employee's login password from the app
-- (Employees > edit > "Reset Password"). The browser only has the public
-- key, which Supabase does not allow to change existing passwords, so the
-- app calls this function instead. Run once in Supabase -> SQL Editor.
--
-- Safety: callable only by a signed-in user whose employee role is
-- 'admin', and only for employees of THEIR OWN company.
-- Returns 'ok', or 'no_login' when the employee has no login yet.
-- =====================================================================
create or replace function public.admin_set_employee_password(p_employee_id uuid, p_new_password text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_caller_company uuid;
  v_auth_id        uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  select company_id into v_caller_company
    from employees
   where auth_id = auth.uid() and role = 'admin' and status = 'active'
   limit 1;
  if v_caller_company is null then
    raise exception 'Only an admin can reset passwords';
  end if;

  select auth_id into v_auth_id
    from employees
   where id = p_employee_id and company_id = v_caller_company;
  if not found then
    raise exception 'Employee not found in your company';
  end if;
  if v_auth_id is null then
    return 'no_login';
  end if;

  update auth.users
     set encrypted_password = crypt(p_new_password, gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at         = now()
   where id = v_auth_id;
  if not found then
    return 'no_login';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.admin_set_employee_password(uuid, text) from public, anon;
grant execute on function public.admin_set_employee_password(uuid, text) to authenticated;

notify pgrst, 'reload schema';
