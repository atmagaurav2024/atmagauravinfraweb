-- Phase 3: lets a whole combined RR group be allotted in one action.
--
-- Allotment (and Execution downstream of it) still work through the
-- existing boq_exec_resources table per BOQ item - that table is the
-- shared backbone the whole execution pipeline depends on, so this
-- deliberately doesn't try to create a "combined allotment" record.
-- Instead: one boq_exec_resources row per item in the group (same as
-- individual RR allotment already does), each traceable back to the
-- combined RR group that authorized it, with the group itself marked
-- 'allotted' as one unit once every item in it is allotted.

alter table boq_exec_resources
  add column if not exists combined_rr_group_id uuid references combined_rr_groups(id) on delete set null,
  add column if not exists combined_rr_item_id uuid references combined_rr_items(id) on delete set null;

create index if not exists idx_boq_exec_resources_combined_rr_group on boq_exec_resources(combined_rr_group_id);
