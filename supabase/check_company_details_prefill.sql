select string_agg(
  'company=' || c.name || ' (' || c.slug || ')' ||
  ' | details_row_exists=' || (cd.id is not null)::text ||
  ' | details.name=' || coalesce(cd.name,'NULL') ||
  ' | details.short_name=' || coalesce(cd.short_name,'NULL') ||
  ' | details.company_id=' || coalesce(cd.company_id::text,'NULL'),
  E'\n'
  order by c.created_at desc
) as result
from companies c
left join company_details cd on cd.company_id = c.id;
