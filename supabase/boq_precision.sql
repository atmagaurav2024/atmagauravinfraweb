-- BOQ precision: keep quantity and rate (and therefore totals) to 10 decimal
-- places. The app displays everything rounded to 2 decimals.
-- Run once in Supabase -> SQL Editor. Safe on existing data.
alter table boq_items
  alter column boq_qty type numeric(24,10),
  alter column rate    type numeric(24,10);

notify pgrst, 'reload schema';
