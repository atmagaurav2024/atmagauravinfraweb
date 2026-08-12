-- Enable Realtime — required one-time step
-- Realtime subscriptions only receive events for tables explicitly added
-- to the supabase_realtime publication (this is separate from RLS —
-- RLS controls whether a row is *readable*, this controls whether change
-- *events* are broadcast at all). Run once in Supabase → SQL Editor.
--
-- Equivalent UI path: Database → Replication → toggle each table on,
-- if you'd rather do it by hand instead of running this.

alter publication supabase_realtime add table public.access_permissions;
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.attendance_punches;
alter publication supabase_realtime add table public.attendance_settings;

-- If a table is already in the publication, the line above for it will
-- error ("relation is already member of publication") — just delete
-- that one line and re-run the rest; it's not harmful, it just means
-- that table's already live.
