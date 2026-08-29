-- Adds quantity and unit fields to Schedule B (Scope of Project) items,
-- so a scope item can carry a measurable qty/unit alongside its
-- description, not just free text.
alter table schedule_b
  add column if not exists scope_qty numeric,
  add column if not exists scope_unit text;
