-- READ-ONLY: shows one voucher with the account codes on each side.
SELECT v.vou_no, v.date, v.type, v.amount, v.party_name, v.narration, v.source_type, v.source_id,
       d.code AS debit_code, d.name AS debit_name,
       c.code AS credit_code, c.name AS credit_name, v.created_at
FROM vouchers v
LEFT JOIN chart_of_accounts d ON d.id = v.debit_account
LEFT JOIN chart_of_accounts c ON c.id = v.credit_account
WHERE v.vou_no = 'PV-AUTO-0490075' OR v.voucher_no = 'PV-AUTO-0490075';
