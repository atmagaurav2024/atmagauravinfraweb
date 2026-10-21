-- Read-only. Every work advance (paid to a party), client advance (received) and client receipt
-- against a sales bill: the TDS / GST recorded on the record vs what is posted in vouchers.
-- Run in the Supabase SQL Editor. Nothing is filtered out; look at the 'flag' column.
with adv as (
  select 'Work advance (paid)'::text as kind, a.id::text as id, a.adv_ref::text as ref, a.date::text as dt,
         a.party_name::text as party, a.amount::numeric as amount,
         coalesce((select sum(coalesce(nullif(d->>'amount',''),'0')::numeric) from jsonb_array_elements(nd.arr) d
                   where coalesce(d->>'is_tds','false') = 'true'),0) as tds_rec,
         coalesce((select sum(coalesce(nullif(g->>'amount',''),'0')::numeric) from jsonb_array_elements(ng.arr) g),0) as gst_rec,
         'work_advance_tds'::text as tds_src, 'work_advance_gst'::text as gst_src,
         a.deductions::text as raw_deductions, a.gst::text as raw_gst
  from work_advances a
  cross join lateral (select case jsonb_typeof(q.j) when 'array' then q.j when 'string' then (case when (q.j #>> '{}') ~ '^\s*\[' then (q.j #>> '{}')::jsonb else '[]'::jsonb end) else '[]'::jsonb end as arr from (select nullif(a.deductions::text,'')::jsonb as j) q) nd
  cross join lateral (select case jsonb_typeof(q.j) when 'array' then q.j when 'string' then (case when (q.j #>> '{}') ~ '^\s*\[' then (q.j #>> '{}')::jsonb else '[]'::jsonb end) else '[]'::jsonb end as arr from (select nullif(a.gst::text,'')::jsonb as j) q) ng
  union all
  select 'Client advance (received)', c.id::text, c.adv_ref::text, c.date::text, null::text, c.amount::numeric,
         coalesce((select sum(coalesce(nullif(d->>'amount',''),'0')::numeric) from jsonb_array_elements(nd.arr) d
                   where coalesce(d->>'is_tds','false') = 'true'),0),
         coalesce((select sum(coalesce(nullif(g->>'amount',''),'0')::numeric) from jsonb_array_elements(ng.arr) g),0),
         'client_advance_tds', 'client_advance_gst',
         c.deductions::text, c.gst::text
  from client_advances c
  cross join lateral (select case jsonb_typeof(q.j) when 'array' then q.j when 'string' then (case when (q.j #>> '{}') ~ '^\s*\[' then (q.j #>> '{}')::jsonb else '[]'::jsonb end) else '[]'::jsonb end as arr from (select nullif(c.deductions::text,'')::jsonb as j) q) nd
  cross join lateral (select case jsonb_typeof(q.j) when 'array' then q.j when 'string' then (case when (q.j #>> '{}') ~ '^\s*\[' then (q.j #>> '{}')::jsonb else '[]'::jsonb end) else '[]'::jsonb end as arr from (select nullif(c.gst::text,'')::jsonb as j) q) ng
  union all
  select 'Client receipt on sales bill', p.id::text, p.reference::text, p.payment_date::text, null::text, p.amount::numeric,
         coalesce(p.tds_amount,0)::numeric, 0::numeric,
         'sales_payment_tds', 'none', null::text, null::text
  from sales_payments p
),
v as (
  select source_id::text as sid, source_type, sum(amount) as amt, count(*) as n
  from vouchers group by source_id::text, source_type
)
select a.kind, a.ref, a.dt as date, a.party, a.amount,
       a.tds_rec as tds_on_record, coalesce(vt.amt,0) as tds_posted,
       a.gst_rec as gst_on_record, coalesce(vg.amt,0) as gst_posted,
       coalesce((select string_agg(x.source_type||'='||x.amt::text, '; ' order by x.source_type) from v x where x.sid=a.id),'(none)') as all_vouchers,
       trim(both ' ' from
         case when round(a.tds_rec) <> round(coalesce(vt.amt,0)) then 'TDS differs ' else '' end ||
         case when round(a.gst_rec) <> round(coalesce(vg.amt,0)) then 'GST differs ' else '' end ||
         case when coalesce(vt.n,0) > 1 or coalesce(vg.n,0) > 1 then 'DUPLICATE' else '' end) as problem,
       case when round(a.tds_rec) = round(coalesce(vt.amt,0)) and round(a.gst_rec) = round(coalesce(vg.amt,0))
             and coalesce(vt.n,0) <= 1 and coalesce(vg.n,0) <= 1 then 'OK' else 'MISMATCH' end as flag,
       a.raw_deductions, a.raw_gst
from adv a
left join v vt on vt.sid=a.id and vt.source_type=a.tds_src
left join v vg on vg.sid=a.id and vg.source_type=a.gst_src
order by (case when round(a.tds_rec) = round(coalesce(vt.amt,0)) and round(a.gst_rec) = round(coalesce(vg.amt,0))
                and coalesce(vt.n,0) <= 1 and coalesce(vg.n,0) <= 1 then 1 else 0 end), a.dt desc;
