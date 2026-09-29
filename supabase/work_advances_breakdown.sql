-- Lets an Advance Payment carry the same Additions / Deductions (incl. TDS)
-- / GST breakdown that Bill Generation already supports, instead of being
-- a single flat figure.
--
-- work_advances.amount keeps its existing meaning: the actual NET cash
-- disbursed to the party. That exact rupee figure is what later gets
-- progressively offset against bills (see adjusted_amount/adjusted_in_bill),
-- so it must keep meaning "cash paid out", not a pre-deduction gross value.
-- base_amount is the new pre-breakdown entry figure the user types; amount
-- is computed from it as base_amount + additions - deductions + gst.
alter table work_advances
  add column if not exists base_amount numeric,
  add column if not exists additions jsonb,
  add column if not exists deductions jsonb,
  add column if not exists gst jsonb;
