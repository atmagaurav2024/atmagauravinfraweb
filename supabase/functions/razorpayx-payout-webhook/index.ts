// RazorpayX sends webhook events (payout.processed, payout.failed,
// payout.reversed, etc.) here as payouts move through their lifecycle
// after being initiated. Verifies the webhook signature before
// trusting anything in the body, then updates the matching
// petty_cash_expenses row by its payout_ref (the RazorpayX payout id)
// — this is what actually confirms the expense automatically, since a
// plain UPI deep link has no way to report success on its own.
//
// After deploying, add this function's URL in RazorpayX Dashboard ->
// Account & Settings -> Webhooks, and set the same secret you choose
// there:
//   supabase secrets set RAZORPAYX_WEBHOOK_SECRET=whatever_you_set
//
// Deploy: supabase functions deploy razorpayx-payout-webhook --no-verify-jwt
// (--no-verify-jwt because RazorpayX calls this directly, not through
// a logged-in user's session)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const webhookSecret = Deno.env.get("RAZORPAYX_WEBHOOK_SECRET") ?? "";

    const expectedSig = await hmacHex(webhookSecret, rawBody);
    if (expectedSig !== signature) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const payout = event.payload?.payout?.entity;
    if (!payout) return new Response("ok", { status: 200 });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let status = "processing";
    let failureReason: string | null = null;
    if (event.event === "payout.processed") {
      status = "success";
    } else if (event.event === "payout.failed") {
      status = "failed";
      failureReason = payout.failure_reason || "Payout failed";
    } else if (event.event === "payout.reversed") {
      status = "failed";
      failureReason = "Payout reversed by bank";
    }

    await supabaseAdmin
      .from("petty_cash_expenses")
      .update({
        payout_status: status,
        payout_utr: payout.utr || null,
        payout_failure_reason: failureReason,
      })
      .eq("payout_ref", payout.id);

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("error", { status: 500 });
  }
});
