-- Gives every advance payment its own identifiable reference number
-- (ADV/YYYY/NNNN, same numbering pattern as bill_ref on work_bills) so it
-- can be shown consistently wherever an advance is referenced — the
-- advance list, the bill-generation advance-adjustment picker, advance
-- receipts, and any bill's advance-adjustment breakdown/PDF.
alter table work_advances
  add column if not exists adv_ref text;
