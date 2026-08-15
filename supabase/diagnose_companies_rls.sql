-- Diagnostic: current RLS policies on companies
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where tablename = 'companies';

-- Diagnostic: does anon actually have INSERT granted?
select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'companies';

-- Diagnostic: is RLS even enabled, and is it forced?
select relrowsecurity, relforcerowsecurity
from pg_class
where relname = 'companies';
