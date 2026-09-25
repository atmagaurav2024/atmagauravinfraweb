-- Classifies a project's contract/execution methodology, so downstream
-- features (billing, Schedule B/H relevance, etc.) can branch on it.
alter table projects
  add column if not exists execution_mode text;
