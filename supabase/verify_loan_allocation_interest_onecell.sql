-- ⚠️ OUTDATED — this used the same buggy formula the app had: it assumed
-- the full allocated amount stayed outstanding forever, ignoring actual
-- loan repayments. Fixed in the app (lnAllocAccruedInterest /
-- projLoanAllocInterest now reduce correctly as repayments are made).
-- This SQL was not updated to match since it needs a full reducing-
-- balance walk over loan_transactions, which plain SQL cannot express
-- simply. Do not use these numbers for verification — instead compare
-- the app's own per-loan "int due" figure (shown on each loan card)
-- times the allocation's share of that loan's principal.

select string_agg(
  project || ' | ' || lender ||
  ' | loan ' || loan_id ||
  ' | principal ' || loan_principal ||
  ' | rate ' || annual_rate_pct || '%' ||
  ' | loan_start ' || loan_start_date ||
  ' | allocated ' || allocated_amount ||
  ' | eff_from ' || effective_from ||
  ' | eff_to ' || coalesce(effective_to::text, 'open') ||
  ' | days_active ' || days_active ||
  ' | accrued_interest ' || accrued_interest,
  E'\n'
  order by project, lender
) as result
from (
  select
    p.name                                                          as project,
    lp.name                                                          as lender,
    l.id                                                              as loan_id,
    l.principal                                                      as loan_principal,
    l.interest_rate                                                  as annual_rate_pct,
    l.start_date                                                     as loan_start_date,
    la.amount                                                        as allocated_amount,
    la.effective_from,
    la.effective_to,
    greatest(
      0,
      least(coalesce(la.effective_to, current_date), current_date)
        - greatest(la.effective_from, l.start_date)
    )                                                                 as days_active,
    round(
      la.amount * (l.interest_rate / 100.0) *
      (
        greatest(
          0,
          least(coalesce(la.effective_to, current_date), current_date)
            - greatest(la.effective_from, l.start_date)
        ) / 365.0
      ),
      2
    )                                                                 as accrued_interest
  from loan_allocations la
  join loans l           on l.id = la.loan_id
  left join loan_parties lp on lp.id = l.party_id
  join projects p         on p.id = la.project_id
  where la.status = 'ACTIVE' and la.type = 'PROJECT'
) x;
