-- Advance RECEIVED from a client, before a sales bill exists — the mirror
-- image of work_advances (advance PAID to a vendor). Until now no such
-- table existed at all: every client payment had to wait for a sales bill
-- to be raised first. Mirrors work_advances' shape (base_amount/
-- additions/deductions/gst breakdown, adv_ref numbering, adjusted_* running
-- totals for partial adjustment against a later bill) but drops the
-- allotment/batch linkage (sales has no BOQ-allotment concept) and the
-- adjusted_tds column (TDS deducted by a client is only ever recognised at
-- a cash event — this advance, or a later bill payment — never carried
-- forward as something to "adjust" against the bill itself the way
-- Work Amt/GST are).
--
-- GST is recognised on receipt (not deferred to bill stage) — see
-- caPostToAccounts in js/projects.js and the "GST on advance" decision
-- recorded in the Accounting Review doc: this matches Section 13(2)
-- time-of-supply for services and mirrors how the app already claims ITC
-- at advance stage on the purchase side.
create table if not exists client_advances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) default current_company_id(),
  project_id uuid not null references projects(id) on delete cascade,
  date date not null,
  amount numeric not null default 0,        -- net cash actually received (ground truth, like work_advances.amount)
  base_amount numeric,                       -- pre-breakdown figure the user typed
  deductions jsonb,                          -- [{head,amount,pct,is_tds}] — TDS deducted by the client
  gst jsonb,                                 -- [{head,amount,pct}] — GST recognised at receipt
  payment_mode text,
  reference text,
  purpose text,
  adv_ref text,                              -- CADV/YYYY/NNNN, assigned once at creation
  adjusted_amount numeric not null default 0,
  adjusted_work numeric not null default 0,
  adjusted_gst numeric not null default 0,
  adjusted_in_bill uuid references sales_bills(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_advances_company on client_advances(company_id);
create index if not exists idx_client_advances_project on client_advances(project_id);

alter table client_advances enable row level security;
drop policy if exists client_advances_tenant_isolated on client_advances;
create policy client_advances_tenant_isolated on client_advances for all
  using (company_id = current_company_id())
  with check (company_id = current_company_id());

-- TDS deducted by the client when paying an EXISTING sales bill (as
-- distinct from TDS deducted on an advance, above) — tracked as its own
-- column on the payment row rather than folded into `amount`, so a
-- payment with TDS withheld doesn't just look like an underpaid bill.
-- See execSaveSalesPayment / execSalesBillPay in js/projects.js.
alter table sales_payments add column if not exists tds_amount numeric not null default 0;
