-- Removes DUPLICATE auto-posted vouchers: same source record, same type, same accounts, same amount.
-- The OLDEST copy is kept; later copies are deleted. Run STEP 1 first and check the list.

-- STEP 1 (preview): the extra copies that STEP 2 would delete
SELECT v.vou_no, v.date, v.amount, v.type, COALESCE(v.narration, v.party_name, '') AS description, v.source_type, v.created_at
FROM vouchers v
JOIN (
  SELECT id, ROW_NUMBER() OVER (
           PARTITION BY source_type, source_id, debit_account, credit_account, amount
           ORDER BY created_at, id) AS rn
  FROM vouchers
  WHERE source_id IS NOT NULL
) d ON d.id = v.id
WHERE d.rn > 1
ORDER BY v.date DESC, v.created_at;

-- STEP 2 (delete): run only after STEP 1 looks right
-- DELETE FROM vouchers
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id, ROW_NUMBER() OVER (
--              PARTITION BY source_type, source_id, debit_account, credit_account, amount
--              ORDER BY created_at, id) AS rn
--     FROM vouchers
--     WHERE source_id IS NOT NULL
--   ) t WHERE t.rn > 1
-- );
