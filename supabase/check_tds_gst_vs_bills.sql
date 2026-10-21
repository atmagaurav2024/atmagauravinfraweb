-- Read-only. Compares, for every purchase/work bill and sales bill, the TDS and GST the bill
-- says it has against what is actually posted in the vouchers table.
-- Run in the Supabase SQL Editor. Rows with flag <> 'OK' are the mismatches.
-- Purchase bills: TDS = non-advance deductions marked is_tds, less TDS matched to an advance;
--                 GST = additions marked is_gst, less GST matched to an advance.
-- Sales bills:    GST only (no TDS leg on the bill itself), same advance exclusion.
with wb as (
  select 'Purchase'::text as kind, b.id, b.bill_ref, b.bill_date, b.party_name as party, b.project_id,
         nullif(b.additions::text,'')::jsonb   as adds,
         nullif(b.deductions::text,'')::jsonb  as deds
  from work_bills b
),
sb as (
  select 'Sales'::text, b.id, b.bill_ref, b.bill_date, null::text, b.project_id,
         nullif(b.additions::text,'')::jsonb,
         nullif(b.deductions::text,'')::jsonb
  from sales_bills b
),
bills as (select * from wb union all select * from sb),
calc as (
  select k.kind, k.id, k.bill_ref, k.bill_date, k.party, k.project_id,
    coalesce((select sum((a->>'amount')::numeric) from jsonb_array_elements(coalesce(k.adds,'[]'::jsonb)) a
              where coalesce((a->>'is_gst')::boolean,false)),0) as gst_raw,
    coalesce((select sum((d->>'amount')::numeric) from jsonb_array_elements(coalesce(k.deds,'[]'::jsonb)) d
              where not coalesce((d->>'is_advance_adj')::boolean,false)
                and coalesce((d->>'is_tds')::boolean,false)),0) as tds_raw,
    coalesce((select sum((ad->>'amount')::numeric)
              from jsonb_array_elements(coalesce(k.deds,'[]'::jsonb)) d
              cross join lateral jsonb_array_elements(coalesce(d->'advance_details','[]'::jsonb)) ad
              where coalesce((d->>'is_advance_adj')::boolean,false) and d->>'adv_adj_head'='gst_amt'),0) as gst_adv,
    coalesce((select sum((ad->>'amount')::numeric)
              from jsonb_array_elements(coalesce(k.deds,'[]'::jsonb)) d
              cross join lateral jsonb_array_elements(coalesce(d->'advance_details','[]'::jsonb)) ad
              where coalesce((d->>'is_advance_adj')::boolean,false) and d->>'adv_adj_head'='tds_amt'),0) as tds_adv
  from bills k
),
exp as (
  select kind, id, bill_ref, bill_date, party, project_id,
         case when kind='Purchase' then greatest(0, tds_raw - tds_adv) else 0 end as tds_expected,
         greatest(0, gst_raw - gst_adv) as gst_expected
  from calc
),
posted as (
  select source_id::text as sid,
         coalesce(sum(amount) filter (where source_type in ('work_bill_tds')),0) as tds_posted,
         coalesce(sum(amount) filter (where source_type in ('work_bill_gst','sales_bill_gst')),0) as gst_posted,
         count(*) filter (where source_type in ('work_bill_tds')) as tds_vouchers,
         count(*) filter (where source_type in ('work_bill_gst','sales_bill_gst')) as gst_vouchers
  from vouchers
  where source_type in ('work_bill_tds','work_bill_gst','sales_bill_gst')
  group by source_id::text
)
select e.kind, e.bill_ref, e.bill_date, e.party,
       e.tds_expected, coalesce(p.tds_posted,0) as tds_posted,
       e.gst_expected, coalesce(p.gst_posted,0) as gst_posted,
       coalesce(p.tds_vouchers,0) as tds_vouchers, coalesce(p.gst_vouchers,0) as gst_vouchers,
       trim(both ' ' from
         case when round(e.tds_expected) <> round(coalesce(p.tds_posted,0)) then 'TDS differs ' else '' end ||
         case when round(e.gst_expected) <> round(coalesce(p.gst_posted,0)) then 'GST differs ' else '' end ||
         case when coalesce(p.tds_vouchers,0) > 1 or coalesce(p.gst_vouchers,0) > 1 then 'DUPLICATE ' else '' end
       ) as problem,
       case when round(e.tds_expected) = round(coalesce(p.tds_posted,0))
             and round(e.gst_expected) = round(coalesce(p.gst_posted,0))
             and coalesce(p.tds_vouchers,0) <= 1 and coalesce(p.gst_vouchers,0) <= 1
            then 'OK' else 'MISMATCH' end as flag
from exp e
left join posted p on p.sid = e.id::text
where e.tds_expected > 0 or e.gst_expected > 0 or p.sid is not null
order by (case when round(e.tds_expected) = round(coalesce(p.tds_posted,0))
                and round(e.gst_expected) = round(coalesce(p.gst_posted,0))
                and coalesce(p.tds_vouchers,0) <= 1 and coalesce(p.gst_vouchers,0) <= 1 then 1 else 0 end),
         e.bill_date desc;
