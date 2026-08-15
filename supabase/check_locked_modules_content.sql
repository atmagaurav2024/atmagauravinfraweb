select string_agg(
  'PLAN: ' || name || ' | locked_modules=' || coalesce(array_to_string(locked_modules, ', '), '(empty)'),
  E'\n' order by price_monthly
) as plans_result
from plans;

select string_agg(
  c.name || ' (' || c.slug || ') -> plan=' || coalesce(p.name,'NONE'),
  E'\n' order by c.name
) as companies_result
from companies c
left join plans p on p.id = c.plan_id;
