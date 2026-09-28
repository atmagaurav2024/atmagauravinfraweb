-- PAN is needed to attribute TDS withheld from a party's bills to the
-- right deductee (Accounts → TDS tab, and the TDS challan/Form 26Q
-- return). Added to the three master tables the Master Registry's
-- Add/Edit forms (js/registry.js) now capture it on: vendors,
-- subcontractors (also covers "Labour Contractor" party-type bills,
-- which read from this same table) and labourers.
alter table vendors
  add column if not exists pan text;

alter table subcontractors
  add column if not exists pan text;

alter table labourers
  add column if not exists pan text;

NOTIFY pgrst, 'reload schema';
