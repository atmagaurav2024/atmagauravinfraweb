-- Every transaction on this specific loan (₹1,00,000, 23/12/2024,
-- 12% Compound Yearly, party Kshitij Laxman Borkar), in date order,
-- as one copyable line per transaction plus the loan's own header info.

select
  (select 'LOAN: principal=' || l.principal || ' rate=' || l.interest_rate ||
    '% type=' || l.interest_type || ' start=' || l.start_date
   from loans l where l.id = '7bba172b-cf20-40b2-aaf8-03579e687e09')
  || E'\n' ||
  string_agg(
    t.date || ' | ' || t.txn_type || ' | ' || t.amount ||
    coalesce(' | mode=' || t.mode, '') ||
    coalesce(' | ref=' || t.reference, ''),
    E'\n' order by t.date, t.txn_type
  ) as result
from loan_transactions t
where t.loan_id = '7bba172b-cf20-40b2-aaf8-03579e687e09';
