-- Tracks how much of EACH head in an advance (Work Amt incl. Additions,
-- TDS, GST) has already been adjusted against bills, separately from the
-- existing flat adjusted_amount total.
--
-- Without this, "adjusted so far" was only known as one combined number,
-- so there was no way to tell whether a fresh adjustment was about to draw
-- more GST out of an advance than the advance actually has left as GST
-- (it would just silently succeed by eating into the Work/TDS balance
-- instead). With separate running totals per head, a bill can only ever
-- draw from what that specific head still has — anything beyond that is
-- left for the party to be paid in cash/bank instead of force-adjusted.
alter table work_advances
  add column if not exists adjusted_work numeric default 0,
  add column if not exists adjusted_tds numeric default 0,
  add column if not exists adjusted_gst numeric default 0;
