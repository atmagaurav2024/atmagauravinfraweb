select string_agg(
  'PLAN: ' || p.name || ' | price=₹' || p.price_monthly || '/mo | id=' || p.id,
  E'\n' order by p.price_monthly
) as plans_result
from plans p;

select string_agg(
  c.name || ' (' || c.slug || ') is on plan_id=' || coalesce(c.plan_id::text,'NULL') ||
  ' (' || coalesce(p.name,'no plan set') || ', ₹' || coalesce(p.price_monthly::text,'0') || '/mo)' ||
  ' | status=' || c.subscription_status,
  E'\n' order by c.name
) as companies_result
from companies c
left join plans p on p.id = c.plan_id;
