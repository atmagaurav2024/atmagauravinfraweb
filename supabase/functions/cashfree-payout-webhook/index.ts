// Cashfree sends webhook events here as a payout transfer moves through
// its lifecycle after being requested (most transfers settle
// asynchronously, so the synchronous response in initiate-cashfree-payout
// is often just "RECEIVED"/"PENDING" — this is what actually confirms
// success or failure). Verifies the webhook signature before trusting
// anything in the body, then updates the matching petty_cash_expenses
// row by its payout_ref (the transferId *we* generated and sent to
// Cashfree, echoed back in the event).
//
// CONFIRMED FROM A REAL DELIVERY (the "Test & Add Webhook" button in
// Cashfree's dashboard) — this account's webhook is the older
// Payouts V1 format, NOT the V2 JSON format a previous version of
// this file assumed. The body is application/x-www-form-urlencoded,
// not JSON, e.g.:
//   event=TRANSFER_SUCCESS&transferId=...&referenceId=...&acknowledged=1&eventTime=...&utr=...&signature=...
// (TRANSFER_FAILED carries event/transferId/referenceId/reason/signature
// instead of acknowledged/eventTime/utr.)
//
// Signature verification (per Cashfree's Payouts V1 docs) is NOT the
// header-based x-webhook-signature scheme V2 uses. Instead:
//   1. Take every POST field except "signature".
//   2. Sort those fields by key name.
//   3. Concatenate just their VALUES, in that sorted order, no separator.
//   4. HMAC-SHA256 that string using the merchant's own Cashfree
//      Client Secret as the key (the OLDEST active one if keys have
//      ever been regenerated — Cashfree keeps signing with the old one
//      until it's deactivated), then base64-encode the result.
//   5. Compare to the "signature" field.
// There is no separately configured webhook secret — same per-tenant
// lookup as before: find the expense (and its company) by transferId
// first, then verify using THAT company's own client_secret.
//
// When registering this in Cashfree (Payouts Dashboard -> Developers
// -> Webhook -> Add Webhook URL), there's no secret field to fill in
// — just the URL. Clicking "Test & Add Webhook" sends a LOW_BALANCE_ALERT
// test event with no transferId, which this function just acknowledges
// without verifying (nothing to look up a company by) — that's expected,
// not an error.
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
    console.log("Cashfree payout webhook received (raw):", rawBody);

    // Form-urlencoded, e.g. "event=TRANSFER_SUCCESS&transferId=PCT...&..."
    const params = new URLSearchParams(rawBody);
    const fields: Record<string, string> = {};
    for (const [k, v] of params.entries()) fields[k] = v;

    const eventName = fields["event"] || "";
    const transferId = fields["transferId"];
    const receivedSig = fields["signature"] || "";

    if (!transferId) {
      console.log("Cashfree webhook: no transferId (likely the LOW_BALANCE_ALERT test event) — acknowledging without verifying.");
      return new Response("ok", { status: 200 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Look up which company this transfer belongs to BEFORE trusting
    // anything else, so we know whose client_secret to verify against.
    const { data: expense } = await supabaseAdmin
      .from("petty_cash_expenses")
      .select("id, company_id")
      .eq("payout_ref", transferId)
      .single();
    if (!expense) {
      console.error("Cashfree webhook: no expense found for transferId", transferId);
      return new Response("ok", { status: 200 }); // ack — nothing we can do with an unknown transfer
    }

    const { data: payoutSettings } = await supabaseAdmin
      .from("company_payout_settings")
      .select("cashfree_client_secret")
      .eq("company_id", expense.company_id)
      .single();
    const clientSecret = payoutSettings?.cashfree_client_secret || "";

    // Sort every field except "signature" by key, concatenate just the
    // values (no separator), HMAC-SHA256 with the client secret, base64.
    const postData = Object.keys(fields)
      .filter((k) => k !== "signature")
      .sort()
      .map((k) => fields[k])
      .join("");
    const expectedSig = await hmacBase64(clientSecret, postData);

    if (!receivedSig || !clientSecret || expectedSig !== receivedSig) {
      console.error("Cashfree webhook: signature mismatch for transferId", transferId);
      return new Response("Invalid signature", { status: 400 });
    }

    let status: string | null = null;
    let failureReason: string | null = null;
    if (eventName === "TRANSFER_SUCCESS") {
      status = "success";
    } else if (eventName === "TRANSFER_FAILED" || eventName === "TRANSFER_REVERSED") {
      status = "failed";
      failureReason = fields["reason"] || "Payout failed";
    } else {
      console.log("Cashfree webhook: unhandled event type", eventName, "— acknowledging, no status change.");
      return new Response("ok", { status: 200 });
    }

    await supabaseAdmin
      .from("petty_cash_expenses")
      .update({
        payout_status: status,
        payout_utr: fields["utr"] || null,
        payout_failure_reason: failureReason,
      })
      .eq("payout_ref", transferId);

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("error", { status: 500 });
  }
});
