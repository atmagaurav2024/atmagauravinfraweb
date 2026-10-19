-- READ-ONLY: shows how each Combined RR allotment's amount is calculated.
-- amount = qty x rate for every item; "group total" is the sum of those.
-- (For lumpsum allotments the rate was derived as: lumpsum share / qty.)

-- 1) Item by item
select
  g.rr_number,
  g.group_name,
  r.party_name,
  b.item_code,
  coalesce(b.short_name, b.description)           as item,
  r.qty,
  r.unit,
  r.rate,
  round(r.qty * r.rate, 2)                         as amount,        -- qty x rate
  r.lumpsum_amount,
  r.created_at
from boq_exec_resources r
join combined_rr_groups g on g.id = r.combined_rr_group_id
left join boq_items b     on b.id = r.boq_item_id
order by r.created_at desc, g.rr_number, b.item_code;

-- 2) Group totals (should equal the "Total Amount" bar when the allotment was made)
select
  g.rr_number,
  g.group_name,
  r.party_name,
  count(*)                                         as items,
  round(sum(r.qty * r.rate), 2)                    as total_amount,  -- sum of qty x rate
  max(r.lumpsum_amount)                            as lumpsum_entered
from boq_exec_resources r
join combined_rr_groups g on g.id = r.combined_rr_group_id
group by g.rr_number, g.group_name, r.party_name
order by max(r.created_at) desc;
