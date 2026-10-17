-- Minimum stock level per store item (used by Store tab + dashboard Low Stock card).
alter table store_inventory add column if not exists min_qty numeric not null default 0;
notify pgrst, 'reload schema';
