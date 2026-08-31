-- Marks allotment rows that were priced as a lumpsum for the whole
-- combined group rather than item-wise. When set, every item in the
-- batch shares the same lumpsum_amount (the original total entered),
-- letting WO/PO generation collapse the batch into a single line
-- item (group name + lumpsum total) instead of listing each BOQ item
-- with its internally-derived proportional rate.
alter table boq_exec_resources
  add column if not exists lumpsum_amount numeric;
