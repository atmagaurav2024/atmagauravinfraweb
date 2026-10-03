// Cashfree sends webhook events here as a payout transfer moves through
// its lifecycle after being requested (most transfers settle
// asynchronously, so the synchronous response in initiate-cashfree-payout
// is often just "RECEIVED"/"PENDING" — this is what actually confirms
// success or failure). Verifies the webhook signature before trusting
// anything in the body, then updates the matching petty_cash_expenses
// row by its payout_ref (the transfer_id *we* generated and sent to
// Cashfree, echoed back in the event).
//
// Confirmed payload shape (Cashfree's Payouts V2 webhook docs):
//   {
//     "data": {
//       "transfer_id": "...", "cf_transfer_id": "...", "status": "SUCCESS",
//       "status_code": "COMPLETED", "status_description": "...",
//       "transfer_utr": "...", ...
//     },
//     "event_time": "...", "type": "TRANSFER_ACKNOWLEDGED" (or similar)
//   }
// Headers: x-webhook-signature (base64 HMAC-SHA256), x-webhook-timestamp.
//
// IMPORTANT — unlike RazorpayX, Cashfree does NOT use a separately
// configured webhook secret. Per their docs, the signature is
// HMAC-SHA256(client_secret, timestamp + rawBody), base64-encoded,
// where client_secret is "the oldest active" Cashfree API client
// secret on the account — i.e. the same Client Secret stored in
// company_payout_settings.cashfree_client_secret (unless that secret
// has since been rotated/regenerated in Cashfree's dashboard, in
// which case Cashfree keeps signing with the OLDER one until it's
// deactivated — if signatures ever start failing after rotating keys,
// that's almost certainly why).
//
// Because the payload carries no company_id, this function looks up
// the expense (and its company) by payout_ref FIRST, then verifies
// the signature using THAT company's own client_secret — not a single
// shared secret — since this app is multi-tenant and every company
// has its own Cashfree account/keys.
//
// When registering this in Cashfree (Payouts Dashboard -> Developers
// -> Webhook -> Add Webhook URL), there is no secret field to fill in
// — just the URL. Cashfree sends a LOW_BALANCE_ALERT test event on
// "Test & Add Webhook"; that event carries its own signature/timestamp
// INSIDE the payload rather than in headers, which this function does
// not specially handle (it only reads the headers) — expect that one
// test call to log a signature-mismatch warning and be ignored, which
// is harmless; real transfer events use the header-based scheme above.
//
// Deploy: supabase functions deploy cashfree-payout-webhook --no-verify-jwt
// (--no-verify-jwt because Cashfree calls this directly, not through a
// logged-in user's session)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function hmacBase64(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

serve(async (req) => {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature") || "";
    const timestamp = req.headers.get("x-webhook-timestamp") || "";

    const event = JSON.parse(rawBody);
    console.log("Cashfree payout webhook received:", JSON.stringify(event));

    const data = event.data || event;
    const transferId: string | undefined = data.transfer_id || data.transferId;
    const rawStatus: string = (data.status || data.transfer_status || "").toUpperCase();
    const utr: string | null = data.transfer_utr || data.utr || null;

    if (!transferId) {
      console.error("Cashfree webhook: no transfer_id found in payload — likely the LOW_BALANCE_ALERT test event, ignoring.");
      return new Response("ok", { status: 200 }); // ack anyway, nothing to act on
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Look up which company this transfer belongs to BEFORE trusting
    // anything else in the payload, so we know whose client_secret to
    // verify the signature against.
    const { data: expense } = await supabaseAdmin
      .from("petty_cash_expenses")
      .select("id, company_id")
      .eq("payout_ref", transferId)
      .single();
    if (!expense) {
      console.error("Cashfree webhook: no expense found for transfer_id", transferId);
      return new Response("ok", { status: 200 }); // ack — nothing we can do with an unknown transfer
    }

    const { data: payoutSettings } = await supabaseAdmin
      .from("company_payout_settings")
      .select("cashfree_client_secret")
      .eq("company_id", expense.company_id)
      .single();
    const clientSecret = payoutSettings?.cashfree_client_secret || "";

    const expectedSig = await hmacBase64(clientSecret, timestamp + rawBody);
    if (!signature || !clientSecret || expectedSig !== signature) {
      console.error("Cashfree webhook: signature mismatch for transfer_id", transferId);
      return new Response("Invalid signature", { status: 400 });
    }

    let status = "processing";
    let failureReason: string | null = null;
    if (rawStatus === "SUCCESS") {
      status = "success";
    } else if (rawStatus === "FAILED" || rawStatus === "REJECTED" || rawStatus === "MANUALLY_REJECTED") {
      status = "failed";
      failureReason = data.status_description || data.failure_reason || "Payout failed";
    } else if (rawStatus === "REVERSED") {
      status = "failed";
      failureReason = "Payout reversed by bank";
    }

    await supabaseAdmin
      .from("petty_cash_expenses")
      .update({
        payout_status: status,
        payout_utr: utr,
        payout_failure_reason: failureReason,
      })
      .eq("payout_ref", transferId);

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("error", { status: 500 });
  }
});
