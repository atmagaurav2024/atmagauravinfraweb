-- ⚠️ OUTDATED — this used the same buggy formula the app had: it assumed
-- the full allocated amount stayed outstanding forever, ignoring actual
-- loan repayments. Fixed in the app (lnAllocAccruedInterest /
-- projLoanAllocInterest now reduce correctly as repayments are made).
-- This SQL was not updated to match since it needs a full reducing-
-- balance walk over loan_transactions, which plain SQL cannot express
-- simply. Do not use these numbers for verification — instead compare
-- the app's own per-loan "int due" figure (shown on each loan card)
-- times the allocation's share of that loan's principal.

-- Verify: loan allocations per project, and the accrued interest that
-- should match the "Loan-Allocated Interest" card in
-- Project → Other Expenses → Interest Expenses.
--
-- Uses the exact same formula as the app (lnAllocAccruedInterest /
-- projLoanAllocInterest): amount x rate x days_active/365, where
-- days_active is the overlap between [effective_from, effective_to-or-
-- today] and the loan's own [start_date, today].

-- ── 1. Detailed, one row per allocation ──────────────────────────────
select
  p.name                                                        as project,
  lp.name                                                        as lender,
  l.principal                                                    as loan_principal,
  l.interest_rate                                                as annual_rate_pct,
  la.amount                                                      as allocated_amount,
  la.effective_from,
  coalesce(la.effective_to, current_date)                        as effective_to_or_today,
  greatest(
    0,
    least(coalesce(la.effective_to, current_date), current_date)
      - greatest(la.effective_from, l.start_date)
  )                                                               as days_active,
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
  )                                                               as accrued_interest
from loan_allocations la
join loans l          on l.id = la.loan_id
left join loan_parties lp on lp.id = l.party_id
join projects p        on p.id = la.project_id
where la.status = 'ACTIVE' and la.type = 'PROJECT'
order by p.name, lp.name;

-- ── 2. Per-project total, matching the card's headline number ───────
select
  p.name as project,
  round(sum(
    la.amount * (l.interest_rate / 100.0) *
    (
      greatest(
        0,
        least(coalesce(la.effective_to, current_date), current_date)
          - greatest(la.effective_from, l.start_date)
      ) / 365.0
    )
  ), 2) as total_accrued_interest
from loan_allocations la
join loans l   on l.id = la.loan_id
join projects p on p.id = la.project_id
where la.status = 'ACTIVE' and la.type = 'PROJECT'
group by p.name
order by p.name;

-- ── 3. Same thing, as ONE copyable text cell per project ─────────────
-- Handy for pasting into a chat/ticket without screenshotting a table.
select
  p.name || ': ' || count(*) || ' loan(s) allocated, total accrued interest = ' ||
  to_char(round(sum(
    la.amount * (l.interest_rate / 100.0) *
    (
      greatest(
        0,
        least(coalesce(la.effective_to, current_date), current_date)
          - greatest(la.effective_from, l.start_date)
      ) / 365.0
    )
  ), 2), 'FM999,999,990.00')
  as summary
from loan_allocations la
join loans l   on l.id = la.loan_id
join projects p on p.id = la.project_id
where la.status = 'ACTIVE' and la.type = 'PROJECT'
group by p.name
order by p.name;
