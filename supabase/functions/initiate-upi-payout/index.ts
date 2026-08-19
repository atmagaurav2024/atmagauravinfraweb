// Called from the app after a petty cash expense with payment method
// = 'upi' is saved. Looks up the *company's own* RazorpayX credentials
// (never the client's — this always runs server-side with the service
// role key) and walks through RazorpayX's three-step payout flow:
// create a Contact -> create a Fund Account (VPA) for that contact ->
// create the Payout itself, mode UPI.
//
// Deploy: supabase functions deploy initiate-upi-payout

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!payoutSettings || !payoutSettings.is_active) {
      throw new Error("RazorpayX payouts not set up for this company yet");
    }

    const auth = "Basic " + btoa(payoutSettings.razorpayx_key_id + ":" + payoutSettings.razorpayx_key_secret);
    const rpxHeaders = { "Content-Type": "application/json", Authorization: auth };

    // 1) Contact
    const contactRes = await fetch("https://api.razorpay.com/v1/contacts", {
      method: "POST",
      headers: rpxHeaders,
      body: JSON.stringify({
        name: expense.payee_name || "Vendor",
        type: "vendor",
        reference_id: expense.id,
      }),
    });
    const contact = await contactRes.json();
    if (!contactRes.ok) throw new Error(contact.error?.description || "Failed to create RazorpayX contact");

    // 2) Fund account (VPA)
    const faRes = await fetch("https://api.razorpay.com/v1/fund_accounts", {
      method: "POST",
      headers: rpxHeaders,
      body: JSON.stringify({
        contact_id: contact.id,
        account_type: "vpa",
        vpa: { address: expense.payee_upi_id },
      }),
    });
    const fundAccount = await faRes.json();
    if (!faRes.ok) throw new Error(fundAccount.error?.description || "Failed to create fund account — check the UPI ID");

    // 3) Payout
    const payoutRes = await fetch("https://api.razorpay.com/v1/payouts", {
      method: "POST",
      headers: rpxHeaders,
      body: JSON.stringify({
        account_number: payoutSettings.razorpayx_account_number,
        fund_account_id: fundAccount.id,
        amount: Math.round(parseFloat(expense.amount) * 100), // RazorpayX expects paise
        currency: "INR",
        mode: "UPI",
        purpose: "vendor bill",
        queue_if_low_balance: true,
        reference_id: expense.id,
        narration: "Petty cash: " + (expense.description || expense.category || "").slice(0, 30),
      }),
    });
    const payout = await payoutRes.json();
    if (!payoutRes.ok) throw new Error(payout.error?.description || "Payout failed");

    await supabaseAdmin
      .from("petty_cash_expenses")
      .update({
        payout_status: payout.status === "processed" ? "success" : "processing",
        payout_ref: payout.id,
      })
      .eq("id", expense_id);

    return new Response(JSON.stringify({ success: true, payout_id: payout.id, status: payout.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
