-- Read-only. Every purchase bill with what the dashboard bell counts as "pending", and what is
-- really still payable after deductions (TDS etc.) and advance adjustments.
--   dashboard_outstanding = bill_amount - payments linked to the bill   (what the bell uses; pending if > 0.5)
--   real_payable          = bill_amount - all deductions (incl. TDS) - advance adjustments (cash parts)
--   real_outstanding      = real_payable - payments
-- A bill with 'BELL COUNTS IT' that has real_outstanding <= 0 is the false "pending" you are seeing.
with b as (
  select w.id::text as id, w.bill_ref::text as bill_ref, w.bill_date::text as bill_date, w.party_name::text as party,
         coalesce(w.bill_amount,0)::numeric as bill_amount,
         case jsonb_typeof(nullif(w.deductions::text,'')::jsonb)
              when 'array' then nullif(w.deductions::text,'')::jsonb
              when 'string' then (case when (nullif(w.deductions::text,'')::jsonb #>> '{}') ~ '^\s*\[' then (nullif(w.deductions::text,'')::jsonb #>> '{}')::jsonb else '[]'::jsonb end)
              else '[]'::jsonb end as deds
  from work_bills w
),
c as (
  select b.*,
    coalesce((select sum(coalesce(nullif(d->>'amount',''),'0')::numeric) from jsonb_array_elements(b.deds) d
              where not coalesce((d->>'is_advance_adj')::boolean,false)
                and not coalesce((d->>'released')::boolean,false)),0) as deductions_incl_tds,
    coalesce((select sum(coalesce(nullif(d->>'amount',''),'0')::numeric) from jsonb_array_elements(b.deds) d
              where coalesce((d->>'is_advance_adj')::boolean,false)
                and not coalesce((d->>'non_cash')::boolean,false)),0) as advance_adjusted_cash
  from b
),
p as (select bill_id::text as bid, sum(amount) as paid, count(*) as n from work_payments where bill_id is not null group by bill_id::text)
select c.bill_ref, c.bill_date, c.party, c.bill_amount,
       coalesce(p.paid,0) as paid, coalesce(p.n,0) as payments,
       c.bill_amount - coalesce(p.paid,0) as dashboard_outstanding,
       c.deductions_incl_tds, c.advance_adjusted_cash,
       c.bill_amount - c.deductions_incl_tds - c.advance_adjusted_cash as real_payable,
       c.bill_amount - c.deductions_incl_tds - c.advance_adjusted_cash - coalesce(p.paid,0) as real_outstanding,
       case when c.bill_amount - coalesce(p.paid,0) > 0.5 then 'BELL COUNTS IT' else '' end as bell
from c left join p on p.bid = c.id
order by (c.bill_amount - coalesce(p.paid,0) > 0.5) desc, c.bill_date desc, c.bill_ref;
