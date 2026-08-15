-- Backfills a company_details row for any company that doesn't have
-- one yet (the pre-fill insert during signup failed silently for at
-- least the "2002" company — this fixes that immediately, and covers
-- any other company in the same state).
insert into company_details (company_id, name, short_name)
select c.id, c.name, c.short_name
from companies c
left join company_details cd on cd.company_id = c.id
where cd.id is null;

-- Verify — should now show details_row_exists=true for every company.
select string_agg(
  'company=' || c.name || ' (' || c.slug || ')' ||
  ' | details_row_exists=' || (cd.id is not null)::text,
  E'\n'
  order by c.created_at desc
) as result
from companies c
left join company_details cd on cd.company_id = c.id;
