-- Lets one advance payment cover a whole multi-item allotment batch,
-- instead of needing a separate advance record per item - same
-- pattern as batch_id on work_orders.
alter table work_advances
  add column if not exists batch_id text;

create index if not exists idx_work_advances_batch on work_advances(batch_id);
