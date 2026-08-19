// supabase/functions/razorpay-subscription-webhook/index.ts
//
// This is the piece that makes autopay actually work unattended.
// After the first payment (verified in verify-razorpay-subscription),
// every renewal charge happens automatically on Razorpay's side with
// no checkout flow for the app to hook into — the only way to know a
// renewal succeeded, failed, or that the subscription was cancelled
// is this webhook.
//
// Events handled:
//   subscription.charged   -> renewal succeeded, extend billing period,
//                              log payment, ensure status stays active
//   subscription.cancelled -> company or admin cancelled -> mark cancelled
//   subscription.halted    -> Razorpay gave up after repeated retries -> lapsed
//   subscription.pending   -> a charge failed but will be retried -> left
//                              as-is (still active) rather than punishing
//                              the company for a single transient failure
//
// After deploying, register this function's URL in Razorpay Dashboard
// -> Settings -> Webhooks, subscribed to the subscription.* events
// above, and set the same secret you choose there:
//   supabase secrets set RAZORPAY_WEBHOOK_SECRET=<value set in dashboard>
//
// Deploy: supabase functions deploy razorpay-subscription-webhook --no-verify-jwt
// (--no-verify-jwt because Razorpay calls this directly, not through a
// logged-in user's session)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("X-Razorpay-Signature") || "";

    const expectedSig = await hmacHex(RAZORPAY_WEBHOOK_SECRET, rawBody);
    if (expectedSig !== signature) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const subscription = event.payload?.subscription?.entity;
    if (!subscription) return new Response("ok", { status: 200 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("razorpay_subscription_id", subscription.id)
      .single();
    if (!company) return new Response("ok", { status: 200 }); // unrecognized subscription, nothing to do

    if (event.event === "subscription.charged") {
      const payment = event.payload?.payment?.entity;
      const today = new Date();
      const periodEnd = new Date(today);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      if (payment) {
        await supabase.from("payment_history").insert({
          company_id: company.id,
          amount: (payment.amount || 0) / 100,
          currency: "INR", status: "paid",
          method: "razorpay_autopay", gateway_ref: payment.id,
          period_start: today.toISOString().slice(0, 10),
          period_end: periodEnd.toISOString().slice(0, 10),
        });
      }
      await supabase.from("companies").update({
        subscription_status: "active",
        next_billing_date: periodEnd.toISOString().slice(0, 10),
      }).eq("id", company.id);

    } else if (event.event === "subscription.cancelled") {
      await supabase.from("companies").update({
        subscription_status: "lapsed",
      }).eq("id", company.id);

    } else if (event.event === "subscription.halted") {
      // Razorpay tried retrying the charge and gave up — treat the
      // same as cancelled from the company's perspective.
      await supabase.from("companies").update({
        subscription_status: "lapsed",
      }).eq("id", company.id);
    }
    // subscription.pending: a single retry in progress — deliberately
    // no status change, so one transient failure doesn't immediately
    // cut off access while Razorpay is still retrying automatically.

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("error", { status: 500 });
  }
});
