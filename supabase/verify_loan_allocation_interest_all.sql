select
  p.name                                                          as project,
  lp.name                                                          as lender,
  la.id                                                            as allocation_id,
  l.id                                                              as loan_id,
  l.principal                                                      as loan_principal,
  l.interest_rate                                                  as annual_rate_pct,
  l.start_date                                                     as loan_start_date,
  la.amount                                                        as allocated_amount,
  la.effective_from,
  la.effective_to,
  la.status                                                        as allocation_status,
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
  )                                                                 as accrued_interest,
  current_date                                                     as as_of_today
from loan_allocations la
join loans l           on l.id = la.loan_id
left join loan_parties lp on lp.id = l.party_id
join projects p         on p.id = la.project_id
where la.status = 'ACTIVE' and la.type = 'PROJECT'
order by p.name, lp.name;
