-- Rydax multi-tenancy — fix "stack depth limit exceeded" on login
-- Run once in Supabase → SQL Editor.
--
-- current_company_id() queries employees internally (to resolve
-- auth.uid() -> company_id). But that internal query is itself
-- subject to employees' own RLS policy — which calls
-- current_company_id() again to evaluate — which queries employees
-- again — infinite recursion, until Postgres's stack depth limit is
-- hit. This is a well-known Supabase RLS pitfall for exactly this
-- "helper function queries the same table its result secures" pattern.
--
-- The standard fix: mark the function SECURITY DEFINER, so its
-- internal query runs with the function owner's privileges and
-- bypasses RLS for that one lookup only — breaking the recursive
-- cycle. Every other policy that calls current_company_id() is
-- unaffected; they still only see rows in the caller's own company,
-- since the function still resolves the caller's real company_id via
-- their own auth.uid() — it just no longer re-triggers RLS while
-- doing that internal lookup.

create or replace function current_company_id() returns uuid
language sql stable security definer
set search_path = public
as $$
  select company_id from employees where auth_id = auth.uid()
$$;
