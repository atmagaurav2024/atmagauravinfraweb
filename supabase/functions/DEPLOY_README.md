# Deploying the Razorpay Edge Functions

These two functions live in `supabase/functions/` and can't be deployed
through the SQL Editor the way everything else this session has been —
they need the Supabase CLI, since they're actual serverless code, not
database objects.

## 1. Install the Supabase CLI (one-time, if you don't have it)

```bash
npm install -g supabase
```

## 2. Log in and link this project (one-time)

```bash
supabase login
supabase link --project-ref aywlauygsqkivdihbaut
```

(That project ref is from your existing SUPABASE_URL —
`aywlauygsqkivdihbaut.supabase.co`.)

## 3. Set your Razorpay secrets

**Do this in your own terminal, not by pasting the values anywhere
else** — this is what actually keeps the Key Secret safe going forward.

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_live_TPzoYm77mrSWMK
supabase secrets set RAZORPAY_KEY_SECRET=your_key_secret_here
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided
automatically to every Edge Function — nothing to set for those.)

## 4. Deploy both functions

```bash
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```

## 5. Confirm they're live

Check the Supabase dashboard → Edge Functions — both should show as
deployed. You can test create-razorpay-order directly with:

```bash
curl -i --location --request POST \
  'https://aywlauygsqkivdihbaut.supabase.co/functions/v1/create-razorpay-order' \
  --header 'Authorization: Bearer YOUR_OWN_LOGGED_IN_ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"plan_id":"<a real plan id from the plans table>"}'
```

(Get an access token by logging into the app normally, then checking
`currentSession.access_token` in the browser console — or just test
through the app's own "Subscribe" button once that's wired in, which
is the real way this gets used.)

## Once deployed

The app's "Subscribe" button (Company Details → Billing) will call
these automatically. Nothing else to configure — the client-side code
already points at these exact function names.

## About rotating the Key Secret

Since it was shared in chat while setting this up, it's worth
regenerating it from Razorpay's dashboard (Settings → API Keys →
Regenerate) once deployment is confirmed working, then re-running the
`supabase secrets set RAZORPAY_KEY_SECRET=...` command above with the
new value. The old one stops working the moment you regenerate, so
there's no rush — just don't forget to update the secret to match.
