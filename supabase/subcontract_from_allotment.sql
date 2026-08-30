-- Links a subcontract back to the allotment batch it was set up from,
-- so Subcontract Scope no longer requires re-selecting BOQ items from
-- scratch - it derives them from what's already been allotted
-- together (via boq_exec_resources.batch_id) in the Work Allotment
-- tab, eliminating the duplicate "combine items" step.
alter table subcontracts
  add column if not exists source_batch_id text;

create index if not exists idx_subcontracts_source_batch on subcontracts(source_batch_id);
