-- Read-only. For every advance (paid to a party, and received from a client): the amount, what the
-- advance record says has been adjusted, and each bill it was actually utilised against (read from
-- the bills' advance-adjustment deduction rows). One row per advance x bill x head; an advance not
-- yet used shows 'not utilised'.
with bills as (
  select 'Purchase'::text as kind, b.id::text as bill_id, b.bill_ref::text as bill_ref, b.bill_date::text as bill_date,
         b.party_name::text as party, nullif(b.deductions::text,'')::jsonb as j
  from work_bills b
  union all
  select 'Sales', b.id::text, b.bill_ref::text, b.bill_date::text, null::text, nullif(b.deductions::text,'')::jsonb
  from sales_bills b
),
bn as (
  select kind, bill_id, bill_ref, bill_date, party,
         case jsonb_typeof(j) when 'array' then j
              when 'string' then (case when (j #>> '{}') ~ '^\s*\[' then (j #>> '{}')::jsonb else '[]'::jsonb end)
              else '[]'::jsonb end as arr
  from bills
),
uses as (
  select bn.kind, bn.bill_id, bn.bill_ref, bn.bill_date, bn.party,
         ad->>'id' as adv_id, d->>'head' as head, d->>'adv_adj_head' as part,
         coalesce(nullif(ad->>'amount',''),'0')::numeric as amount
  from bn
  cross join lateral jsonb_array_elements(bn.arr) d
  cross join lateral jsonb_array_elements(case when jsonb_typeof(d->'advance_details')='array' then d->'advance_details' else '[]'::jsonb end) ad
  where coalesce(d->>'is_advance_adj','false') = 'true'
),
adv as (
  select 'Work advance (paid)'::text as kind, a.id::text as id, a.adv_ref::text as adv_ref, a.date::text as adv_date,
         a.party_name::text as party, a.amount::numeric as amount, coalesce(a.adjusted_amount,0)::numeric as adjusted_amount,
         'Purchase'::text as bill_kind
  from work_advances a
  union all
  select 'Client advance (received)', c.id::text, c.adv_ref::text, c.date::text, null::text, c.amount::numeric,
         coalesce(c.adjusted_amount,0)::numeric, 'Sales'
  from client_advances c
)
select a.kind, a.adv_ref, a.adv_date, a.party as advance_party, a.amount as advance_amount,
       a.adjusted_amount as adjusted_per_advance_record,
       a.amount - a.adjusted_amount as balance_per_advance_record,
       coalesce(u.bill_ref,'not utilised') as utilised_in_bill, u.bill_date, u.party as bill_party,
       u.head as deduction_head, u.part as advance_part, u.amount as utilised_amount,
       sum(coalesce(u.amount,0)) over (partition by a.id) as total_utilised_per_bills
from adv a
left join uses u on u.adv_id = a.id and u.kind = a.bill_kind
order by a.adv_date, a.adv_ref, u.bill_date, u.bill_ref;
