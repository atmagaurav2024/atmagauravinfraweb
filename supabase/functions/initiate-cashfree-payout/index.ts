// Called from the app after a petty cash expense with payment method
// = 'upi' is saved. Looks up the *company's own* Cashfree Payouts
// credentials (never the client's — this always runs server-side with
// the service role key) and walks through Cashfree's two-step payout
// flow: add/sync a Beneficiary (the vendor's UPI VPA) -> request a
// Transfer to that beneficiary, mode UPI.
//
// Replaces the earlier RazorpayX integration (initiate-upi-payout) —
// kept side by side in company_payout_settings (cashfree_* columns)
// rather than overwriting the razorpayx_* ones, so nothing is lost for
// a company that configured RazorpayX previously.
//
// Deploy: supabase functions deploy initiate-cashfree-payout
//
// Cashfree's Payouts API only accepts calls from IP addresses you've
// whitelisted in advance in their Dashboard (Developers -> Payouts ->
// Two-Factor Authentication -> IP Whitelist) — including in sandbox.
// Supabase Edge Functions don't run from one fixed outbound IP, so
// there's nothing stable to whitelist there directly. Instead, every
// call to Cashfree below is routed through a small fixed-IP proxy
// (e.g. a free Webshare.io datacenter proxy); it's that proxy's IP
// which actually gets whitelisted in Cashfree, not this function's own.
//
// Set this function's proxy with:
//   supabase secrets set CASHFREE_PROXY_URL=http://USERNAME:PASSWORD@HOST:PORT
// (leave CASHFREE_PROXY_URL unset to call Cashfree directly, with no
// proxy — only useful once/if Cashfree ever drops the IP requirement).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cashfree beneficiary/transfer IDs must be alphanumeric (plus a couple
// of safe separators) and reasonably short. Expense UUIDs contain
// hyphens, which Cashfree's beneficiary_id does NOT reliably accept, so
// strip everything but letters/digits and prefix to guarantee it's
// non-empty and doesn't start with a digit-only collision risk.
function safeId(prefix: string, raw: string): string {
  return (prefix + raw.replace(/[^a-zA-Z0-9]/g, "")).slice(0, 40);
}

// Builds a Deno HTTP client that routes through CASHFREE_PROXY_URL, if
// set. Returns undefined (meaning: call Cashfree directly) when the
// secret isn't set, so this is a no-op until a proxy is actually
// configured.
function buildProxyClient(): Deno.HttpClient | undefined {
  const proxyUrl = Deno.env.get("CASHFREE_PROXY_URL");
  if (!proxyUrl) return undefined;
  const p = new URL(proxyUrl);
  return Deno.createHttpClient({
    proxy: {
      url: p.protocol + "//" + p.hostname + ":" + p.port,
      basicAuth: p.username ? { username: p.username, password: p.password } : undefined,
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { expense_id } = await req.json();
    if (!expense_id) throw new Error("expense_id is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Identify the caller and their company from their own session —
    // same pattern as the subscription order-creation function, never
    // trust a client-supplied company_id.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: employee } = await supabaseAdmin
      .from("employees")
      .select("company_id")
      .eq("auth_id", user.id)
      .single();
    if (!employee?.company_id) throw new Error("Could not resolve company");

    const { data: expense } = await supabaseAdmin
      .from("petty_cash_expenses")
      .select("*")
      .eq("id", expense_id)
      .eq("company_id", employee.company_id) // tenant safety, belt & suspenders alongside RLS
      .single();
    if (!expense) throw new Error("Expense not found");
    if (!expense.payee_upi_id) throw new Error("No UPI ID on this expense");

    const { data: payoutSettings } = await supabaseAdmin
      .from("company_payout_settings")
      .select("*")
      .eq("company_id", employee.company_id)
      .single();
    if (!payoutSettings || !payoutSettings.is_active || !payoutSettings.cashfree_client_id) {
      throw new Error("Cashfree payouts not set up for this company yet");
    }

    const base = payoutSettings.cashfree_env === "production"
      ? "https://api.cashfree.com/payout"
      : "https://sandbox.cashfree.com/payout";

    const cfHeaders = {
      "Content-Type": "application/json",
      "x-client-id": payoutSettings.cashfree_client_id,
      "x-client-secret": payoutSettings.cashfree_client_secret,
      "x-api-version": "2024-01-01",
    };

    const beneficiaryId = safeId("PCB", expense.id);
    const transferId = safeId("PCT", expense.id);

    var proxyClient = buildProxyClient();
    var fetchOpts = proxyClient ? { client: proxyClient } : {};
    var bene: any, transfer: any;
    try {
      // 1) Beneficiary — create (or reuse, if this is a retry after a
      // transient failure and the beneficiary already exists).
      const beneRes = await fetch(base + "/beneficiary", {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify({
          beneficiary_id: beneficiaryId,
          beneficiary_name: (expense.payee_name || "Vendor").slice(0, 100),
          beneficiary_instrument_details: { vpa: expense.payee_upi_id },
        }),
        ...fetchOpts,
      });
      bene = await beneRes.json();
      const beneAlreadyExists = !beneRes.ok &&
        JSON.stringify(bene).toLowerCase().includes("already exist");
      if (!beneRes.ok && !beneAlreadyExists) {
        console.error("Cashfree beneficiary error, full response:", JSON.stringify(bene));
        throw new Error(bene.message || "Failed to add Cashfree beneficiary — check the UPI ID");
      }

      // 2) Transfer
      const transferRes = await fetch(base + "/transfers", {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify({
          transfer_id: transferId,
          transfer_amount: parseFloat(expense.amount),
          transfer_currency: "INR",
          transfer_mode: "upi",
          beneficiary_details: { beneficiary_id: beneficiaryId },
          transfer_remarks: ("Petty cash: " + (expense.description || expense.category || "")).slice(0, 70),
        }),
        ...fetchOpts,
      });
      transfer = await transferRes.json();
      if (!transferRes.ok) {
        console.error("Cashfree transfer error, full response:", JSON.stringify(transfer));
        throw new Error(transfer.message || "Payout failed");
      }
    } finally {
      if (proxyClient) proxyClient.close();
    }

    // Cashfree's synchronous response status is typically one of
    // RECEIVED / PENDING / APPROVAL_PENDING / SUCCESS / FAILED / REJECTED
    // at this point — most transfers settle asynchronously and the real
    // outcome arrives via the webhook below, so anything not an explicit
    // terminal state here is left as "processing".
    const status = (transfer.status || "").toUpperCase();
    const settled = status === "SUCCESS";
    const failed = status === "FAILED" || status === "REJECTED";

    await supabaseAdmin
      .from("petty_cash_expenses")
      .update({
        payout_status: settled ? "success" : failed ? "failed" : "processing",
        payout_ref: transferId,
        payout_failure_reason: failed ? (transfer.status_description || "Payout failed") : null,
      })
      .eq("id", expense_id);

    return new Response(JSON.stringify({ success: true, transfer_id: transferId, status: transfer.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Logged so the actual reason shows up in Supabase's Logs tab for this
    // function, not just in the app's own (fast-disappearing) toast.
    console.error("initiate-cashfree-payout error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
