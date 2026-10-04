-- Run this after add_digilocker_integration.sql.
--
-- The first version of digilocker-check marked a record Verified as
-- soon as ANYONE completed DigiLocker consent, without checking that
-- the documents pulled back actually belonged to the person on this
-- record (name_as_per_pan). Fixed in code, but needs these columns to
-- record what DigiLocker actually returned, visible on the record
-- whether it matched (kyc_status='verified') or didn't
-- (kyc_status='rejected', with kyc_remarks explaining the mismatch) —
-- so whoever reviews it can see both sides rather than a bare status.

alter table employees
  add column if not exists kyc_digilocker_name text,
  add column if not exists kyc_digilocker_dob text;

alter table vendors
  add column if not exists kyc_digilocker_name text,
  add column if not exists kyc_digilocker_dob text;

alter table subcontractors
  add column if not exists kyc_digilocker_name text,
  add column if not exists kyc_digilocker_dob text;

alter table labourers
  add column if not exists kyc_digilocker_name text,
  add column if not exists kyc_digilocker_dob text;
