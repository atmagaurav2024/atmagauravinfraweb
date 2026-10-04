-- KYC / DigiLocker self-verification fields — Employees, Vendors,
-- Subcontractors and Labourers.
--
-- There is no low-cost way for a business this size to get direct
-- DigiLocker API access (that requires becoming a certified DigiLocker
-- "Requestor Organization" through a paid Technology Solution Provider,
-- with per-verification fees and a business approval process). The free
-- route used here instead: the person verifies themselves — they log
-- into digilocker.gov.in (or the DigiLocker app) with their OWN
-- Aadhaar-linked mobile OTP, download their Aadhaar/PAN/education
-- certificates (DigiLocker-issued files carry a digital signature/QR
-- code proving they're genuine), and upload those PDFs through the
-- registration form. Whoever has edit access then checks the signature
-- at DigiLocker's free public "Verify Document" page and marks the
-- record Verified or Rejected.
--
-- Full Aadhaar numbers are already stored in plain text on `employees`
-- and `labourers` from before this change (pre-existing design, not
-- introduced here) — be aware the Aadhaar Act restricts how a private
-- entity may collect/store Aadhaar numbers, so it's worth limiting who
-- can read these columns (e.g. via RLS) and not displaying the full
-- number anywhere it doesn't need to be.

alter table employees
  add column if not exists name_as_per_pan text,
  add column if not exists education_doc_url text,
  add column if not exists kyc_status text default 'pending', -- 'pending' | 'verified' | 'rejected'
  add column if not exists kyc_verified_by text,
  add column if not exists kyc_verified_at timestamptz,
  add column if not exists kyc_remarks text;

alter table vendors
  add column if not exists aadhar text, -- authorized signatory's Aadhaar, not the company's
  add column if not exists name_as_per_pan text,
  add column if not exists aadhar_doc_url text,
  add column if not exists pan_doc_url text,
  add column if not exists education_doc_url text,
  add column if not exists kyc_status text default 'pending',
  add column if not exists kyc_verified_by text,
  add column if not exists kyc_verified_at timestamptz,
  add column if not exists kyc_remarks text;

alter table subcontractors
  add column if not exists aadhar text, -- authorized signatory's Aadhaar, not the firm's
  add column if not exists name_as_per_pan text,
  add column if not exists aadhar_doc_url text,
  add column if not exists pan_doc_url text,
  add column if not exists education_doc_url text,
  add column if not exists kyc_status text default 'pending',
  add column if not exists kyc_verified_by text,
  add column if not exists kyc_verified_at timestamptz,
  add column if not exists kyc_remarks text;

alter table labourers
  add column if not exists name_as_per_pan text,
  add column if not exists aadhar_doc_url text,
  add column if not exists pan_doc_url text,
  add column if not exists education_doc_url text,
  add column if not exists kyc_status text default 'pending',
  add column if not exists kyc_verified_by text,
  add column if not exists kyc_verified_at timestamptz,
  add column if not exists kyc_remarks text;
