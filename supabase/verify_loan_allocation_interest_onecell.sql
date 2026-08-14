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
