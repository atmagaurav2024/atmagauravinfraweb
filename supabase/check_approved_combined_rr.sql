-- READ-ONLY: the approved (not yet allotted) Combined RR(s), item by item.
-- Shows quantity and planned rate, and the amount the form would show if you
-- accept the planned rate (qty x planned rate).
select
  g.rr_number,
  g.group_name,
  g.status,
  coalesce(b.short_name, b.description)        as item,
  i.party_name,
  i.qty,
  p.rate                                        as planned_rate,
  round(i.qty * coalesce(p.rate,0), 2)          as amount_at_planned_rate,
  sum(round(i.qty * coalesce(p.rate,0), 2)) over (partition by g.id) as group_total_at_planned_rate
from combined_rr_groups g
join combined_rr_items i      on i.group_id = g.id
left join combined_plan_items p on p.id = i.plan_item_id
left join boq_items b         on b.id = i.boq_item_id
where g.status = 'approved'
order by g.created_at desc, item;
