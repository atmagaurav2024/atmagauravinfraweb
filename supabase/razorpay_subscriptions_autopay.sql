-- Switch subscription billing from one-time payments to recurring
-- autopay (Razorpay Subscriptions API — UPI Autopay / card mandate).
-- Run once in Supabase → SQL Editor.

-- Each app plan needs a matching Razorpay Plan (created once via the
-- Razorpay Dashboard → Subscriptions → Plans, or their API) — this
-- just links the two. Set via Platform Admin → Plans → Edit.
alter table plans add column if not exists razorpay_plan_id text;

-- Tracks which Razorpay subscription is currently active for a
-- company, and when the next autopay charge is expected — shown in
-- Company Details > Billing so an admin can see autopay is live
-- without needing to check Razorpay's own dashboard.
alter table companies add column if not exists razorpay_subscription_id text;
alter table companies add column if not exists next_billing_date date;
