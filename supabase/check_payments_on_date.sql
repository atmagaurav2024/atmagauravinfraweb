-- Read-only. Every payment / receipt recorded on a given date, plus every voucher dated that day.
-- Change the date in the first line if you want another day.
with d as (select date '2026-10-20' as day)
select 'Bill payment (paid out)' as kind, p.payment_date::text as date, p.amount::text as amount,
       p.payment_mode::text as mode, p.reference::text as reference, b.bill_ref::text as bill, b.party_name::text as party
from work_payments p
left join work_bills b on b.id::text = p.bill_id::text, d
where p.payment_date::text like d.day::text || '%'
union all
select 'Client receipt', p.payment_date::text, p.amount::text, p.payment_mode::text, p.reference::text, s.bill_ref::text, null
from sales_payments p
left join sales_bills s on s.id::text = p.sales_bill_id::text, d
where p.payment_date::text like d.day::text || '%'
union all
select 'Voucher ('||v.type::text||')', v.date::text, v.amount::text, null, v.narration::text, v.source_type::text, v.party_name::text
from vouchers v, d
where v.date::text like d.day::text || '%'
order by 1, 2;
