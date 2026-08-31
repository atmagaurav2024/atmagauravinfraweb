-- Lets a combined planning group be given a descriptive name (e.g.
-- "Bituminous Concrete Work", "Earthwork Package 1"), separate from
-- the subcontractor's own name, and carries that name through RR and
-- Allotment so WO/PO documents and every downstream screen can show
-- what the combined group of work actually is, not just who it's
-- allotted to.
alter table combined_plan_groups
  add column if not exists group_name text;

alter table combined_rr_groups
  add column if not exists group_name text;

alter table boq_exec_resources
  add column if not exists group_name text;
