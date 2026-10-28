-- Loans passed on to an employee / petty cash used to be posted to the clearing
-- account 1102 and never touched the Bank. New loans now go
--   Dr Bank (1002) / Cr Loans Payable (2201)      -- loan received by the company
--   Dr Petty Cash (1101) / Cr Bank (1002)         -- paid on to the employee
-- This one-off script moves the EXISTING petty-cash loans to the same shape so they
-- show in the Bank statement. Run once in Supabase -> SQL Editor.
-- Step 0 shows what will change. Steps 1-2 are the changes (wrapped in a transaction).

-- Step 0 (preview, read only)
select v.vou_no, v.date, v.amount, v.narration,
       (select code from chart_of_accounts where id = v.debit_account)  as dr_code,
       (select code from chart_of_accounts where id = v.credit_account) as cr_code
from vouchers v
where (v.source_type = 'loan' and v.source_id in (select id from loans where to_petty_cash = true)
       and v.debit_account = (select id from chart_of_accounts where code = '1102' limit 1))
   or (v.source_type = 'petty_cash_in' and v.narration ilike '%from loan%'
       and v.credit_account = (select id from chart_of_accounts where code = '1102' limit 1))
order by v.date;

begin;

-- Step 1: loan received -> company cash (if the loan was received in cash) or company bank,
-- instead of the clearing account
update vouchers v
set debit_account = (select id from chart_of_accounts
                     where code = case when l.mode in ('Cash','EmpCash') then '1001' else '1002' end limit 1)
from loans l
where v.source_type = 'loan' and v.source_id = l.id
  and l.to_petty_cash = true
  and v.debit_account = (select id from chart_of_accounts where code = '1102' limit 1);

-- Step 2: transfer to petty cash now comes out of the same company cash/bank account.
-- Matched to its loan through the petty cash row (petty_cash_in.loan_id).
update vouchers v
set credit_account = (select id from chart_of_accounts
                      where code = case when l.mode in ('Cash','EmpCash') then '1001' else '1002' end limit 1)
from petty_cash_in p, loans l
where v.source_type = 'petty_cash_in' and v.source_id = p.id
  and p.loan_id = l.id
  and v.credit_account = (select id from chart_of_accounts where code = '1102' limit 1);

commit;
