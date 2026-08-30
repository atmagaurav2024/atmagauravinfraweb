-- Lets each WO/PO have its own editable Terms & Conditions text,
-- instead of the same hardcoded list on every document. Saved once at
-- generation time (immutable after, same as the doc number) so
-- re-downloading later always shows the same document that was
-- actually issued.
alter table work_orders
  add column if not exists terms text;
