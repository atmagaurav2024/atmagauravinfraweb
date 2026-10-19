-- Fix for Combined Plans that were saved with "Use one rate for all items" when
-- the number entered was meant as ONE TOTAL AMOUNT for the group.
-- Before the fix, that number was copied onto every item as a per-unit rate.
-- This re-shares the amount across the items (by qty x BOQ rate, by qty if the
-- BOQ rates are blank) and stores each item's own rate = share / qty.
--
-- STEP 1 - run this first: PREVIEW only, nothing is changed.
with base as (
  select i.id, g.id as gid, g.group_name, g.custom_rate as total_amount,
         i.qty, i.rate as current_rate,
         i.qty * coalesce(b.rate,0) as val
  from combined_plan_groups g
  join combined_plan_items i on i.group_id = g.id
  left join boq_items b      on b.id = i.boq_item_id
  where g.rate_mode = 'custom'
    and g.group_name = 'Construction of Complete FOB'   -- <- change/remove to fix other groups
), w as (
  select *,
         case when sum(val) over (partition by gid) > 0 then val else qty end as wt
  from base
), w2 as (
  select *, sum(wt) over (partition by gid) as wt_sum from w
)
select group_name, total_amount, qty, current_rate,
       round(total_amount * wt / wt_sum, 2)                   as item_amount,
       round(total_amount * wt / wt_sum / nullif(qty,0), 10)  as new_rate
from w2
order by group_name;

-- STEP 2 - after checking the preview, run this to apply it.
-- (Remove the "-- " at the start of each line below to enable. It only touches
-- the group named above.)
-- with base as (
--   select i.id, g.id as gid, g.custom_rate as total_amount, i.qty,
--          i.qty * coalesce(b.rate,0) as val
--   from combined_plan_groups g
--   join combined_plan_items i on i.group_id = g.id
--   left join boq_items b on b.id = i.boq_item_id
--   where g.rate_mode = 'custom' and g.group_name = 'Construction of Complete FOB'
-- ), w as (
--   select *, case when sum(val) over (partition by gid) > 0 then val else qty end as wt from base
-- ), w2 as (
--   select *, sum(wt) over (partition by gid) as wt_sum from w
-- )
-- update combined_plan_items p
--    set rate = round(w2.total_amount * w2.wt / w2.wt_sum / nullif(w2.qty,0), 10)
--   from w2 where p.id = w2.id;
