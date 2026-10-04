-- Run this after add_digilocker_identity_check.sql.
--
-- Aadhaar's DigiLocker record includes a photo (PAN's doesn't) -
-- stored here on a match, and for employees specifically also copied
-- onto their existing profile_photo field so it shows up as their
-- normal profile picture without any extra UI work.

alter table employees     add column if not exists kyc_photo_url text;
alter table vendors       add column if not exists kyc_photo_url text;
alter table subcontractors add column if not exists kyc_photo_url text;
alter table labourers     add column if not exists kyc_photo_url text;
