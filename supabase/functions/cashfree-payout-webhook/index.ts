// Cashfree sends webhook events here as a payout transfer moves through
// its lifecycle after being requested (most transfers settle
// asynchronously, so the synchronous response in initiate-cashfree-payout
// is often just "RECEIVED"/"PENDING" — this is what actually confirms
// success or failure). Verifies the webhook signature before trusting
// anything in the body, then updates the matching petty_cash_expenses
// row by its payout_ref (the transfer_id *we* generated and sent to
// Cashfree, echoed back in the event).
//
// IMPORTANT — unverified against a real delivery: Cashfree's documented
// signature scheme for their Payments product is
//   base64(HMAC-SHA256(secret, timestamp + rawBody))
// sent as the `x-webhook-signature` header alongside `x-webhook-timestamp`.
// Their Payouts product has historically used the same webhook
// infrastructure, so this function assumes the same scheme — but I
// could not confirm this against Cashfree's Payouts-specific webhook
// docs. The event payload shape below is best-effort for the same
// reason: it tries a few reasonable field paths and logs the raw body
// on every call. Once this is deployed and a real payout fires a real
// webhook, check this function's logs (supabase functions logs
// cashfree-payout-webhook) for the actual shape Cashfree sends, and
// adjust the field paths / signature check below if they don't match.
//
// After deploying, add this function's URL in the Cashfree Dashboard ->
// Developers -> Webhooks (Payouts), and set the same secret you choose
// there:
//   supabase secrets set CASHFREE_WEBHOOK_SECRET=whatever_you_set
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
    const webhookSecret = Deno.env.get("CASHFREE_WEBHOOK_SECRET") ?? "";

    const expectedSig = await hmacBase64(webhookSecret, timestamp + rawBody);
    if (!signature || expectedSig !== signature) {
      console.error("Cashfree webhook: signature mismatch", { signature, timestamp });
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(rawBody);
    console.log("Cashfree payout webhook received:", JSON.stringify(event));

    // Best-effort: try the couple of shapes Cashfree is known to use
    // elsewhere (a top-level "data" wrapper, or the transfer fields at
    // the top level directly).
    const data = event.data || event;
    const transferId: string | undefined = data.transfer_id || data.transferId;
    const rawStatus: string = (data.status || data.transfer_status || "").toUpperCase();
    const utr: string | null = data.utr || data.transfer_utr || null;

    if (!transferId) {
      console.error("Cashfree webhook: no transfer_id found in payload");
      return new Response("ok", { status: 200 }); // ack anyway, nothing to act on
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let status = "processing";
    let failureReason: string | null = null;
    if (rawStatus === "SUCCESS") {
      status = "success";
    } else if (rawStatus === "FAILED" || rawStatus === "REJECTED") {
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
