-- PostgREST caches the database schema (including RLS policies) and
-- doesn't always pick up changes immediately after they're made via
-- SQL Editor — especially after a lot of ALTER/CREATE POLICY changes
-- in one session, like this migration. This tells it to reload now.
notify pgrst, 'reload schema';
