-- Party name is no longer required when combined-planning a group of
-- items - Planning is a rough estimate stage (which items, how much,
-- what scope) and the actual party gets a fresh, proper selection
-- later at Allotment, matching how the regular (non-combined)
-- allotment flow already always re-asks for party regardless of what
-- Planning estimated.
alter table combined_plan_groups
  alter column party_name drop not null;

alter table combined_rr_items
  alter column party_name drop not null;
