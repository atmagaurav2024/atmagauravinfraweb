-- Run this ONE query — both results come back as single copyable text
-- cells instead of tables.

select
  'POLICIES: ' || coalesce(string_agg(
    policyname || ' [' || cmd || '] roles=' || array_to_string(roles,',') ||
    ' permissive=' || permissive ||
    ' using=' || coalesce(qual,'—') ||
    ' with_check=' || coalesce(with_check,'—'),
    E'\n  '
  ), 'NONE FOUND')
from pg_policies
where tablename = 'companies';

select
  'GRANTS: ' || coalesce(string_agg(grantee || '=' || privilege_type, ', '), 'NONE FOUND')
from information_schema.role_table_grants
where table_name = 'companies';
