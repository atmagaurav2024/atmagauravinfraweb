-- Activities and Resources for a Combined Planning group.
-- They are stored in the normal boq_subitems (activities) and boq_exec_resources (planned
-- resources) tables, tagged with the combined group, so RR and Allotment work exactly as
-- they do for item-wise planning. They are anchored to the group's first BOQ item.
-- Run once in Supabase -> SQL Editor.

alter table boq_subitems
  add column if not exists combined_plan_group_id uuid references combined_plan_groups(id) on delete cascade;

alter table boq_exec_resources
  add column if not exists combined_plan_group_id uuid references combined_plan_groups(id) on delete cascade;

create index if not exists idx_boq_subitems_cpg  on boq_subitems(combined_plan_group_id);
create index if not exists idx_boq_exec_res_cpg  on boq_exec_resources(combined_plan_group_id);

NOTIFY pgrst, 'reload schema';
