-- Read-only. Lists EVERY purchase and sales bill with its raw additions / deductions and every
-- voucher posted against it (any source type), so nothing is filtered out.
-- Run in the Supabase SQL Editor. Send me the result (or export as CSV).
select 'Purchase' as kind, b.bill_ref::text as bill_ref, b.bill_date::text as bill_date,
       b.party_name::text as party, b.bill_amount::text as bill_amount,
       b.additions::text as additions, b.deductions::text as deductions,
       (select coalesce(string_agg(v.source_type||'='||v.amount::text, '; ' order by v.source_type),'(none)')
          from vouchers v where v.source_id::text = b.id::text) as vouchers_posted
from work_bills b
union all
select 'Sales', b.bill_ref::text, b.bill_date::text, null, b.bill_amount::text,
       b.additions::text, b.deductions::text,
       (select coalesce(string_agg(v.source_type||'='||v.amount::text, '; ' order by v.source_type),'(none)')
          from vouchers v where v.source_id::text = b.id::text)
from sales_bills b
order by 3 desc, 2;
