-- Checks whether new signups are stuck waiting on email confirmation.
-- If email_confirmed_at is null for your new company's account, that's
-- almost certainly why login returns 400 — Supabase Auth's default
-- "Confirm email" setting requires clicking a link sent to the
-- account's email before it can sign in, and since these are synthetic
-- addresses (phone@slug.rydax.internal), no such email can ever
-- actually be received or clicked.

select
  u.email,
  u.email_confirmed_at,
  u.created_at,
  e.emp_id,
  e.role
from auth.users u
left join employees e on e.auth_id = u.id
where u.email like '%.rydax.internal'
order by u.created_at desc;
