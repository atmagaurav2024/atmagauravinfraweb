-- READ-ONLY check: finds duplicate vouchers touching Cash in Hand (1001) / Bank (1002).
-- Run each block separately in the Supabase SQL Editor and send me the results.

-- Block 1: same posting made more than once for the same source record (e.g. a petty cash expense or loan posted twice)
SELECT v.source_type, v.source_id, COUNT(*) AS copies,
       MIN(v.date) AS date, MIN(v.amount) AS amount,
       string_agg(v.vou_no, ', ' ORDER BY v.created_at) AS vou_nos
FROM vouchers v
JOIN chart_of_accounts a ON a.id IN (v.debit_account, v.credit_account) AND a.code IN ('1001','1002')
WHERE v.source_id IS NOT NULL
GROUP BY v.source_type, v.source_id, v.debit_account, v.credit_account
HAVING COUNT(*) > 1
ORDER BY MIN(v.date) DESC;

-- Block 2: look-alike entries (same date, amount, accounts and narration) even without a source link
SELECT v.date, v.amount, v.type, COALESCE(v.narration, v.party_name, '') AS description,
       COUNT(*) AS copies,
       string_agg(v.vou_no || COALESCE(' [' || v.source_type || ']', ''), ', ' ORDER BY v.created_at) AS vou_nos
FROM vouchers v
JOIN chart_of_accounts a ON a.id IN (v.debit_account, v.credit_account) AND a.code IN ('1001','1002')
GROUP BY v.date, v.amount, v.type, COALESCE(v.narration, v.party_name, ''), v.debit_account, v.credit_account
HAVING COUNT(*) > 1
ORDER BY v.date DESC;
