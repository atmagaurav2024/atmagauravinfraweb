-- Optional GST on Work Orders / Purchase Orders.
-- gst_pct = GST % added on top of the order total (null / 0 = no GST shown).
-- Run once in Supabase -> SQL Editor.
alter table work_orders
  add column if not exists gst_pct numeric;

NOTIFY pgrst, 'reload schema';
