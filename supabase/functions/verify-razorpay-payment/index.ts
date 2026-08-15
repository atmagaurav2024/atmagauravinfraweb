// supabase/functions/verify-razorpay-payment/index.ts
//
// Verifies a completed Razorpay payment server-side before trusting it
// — this is THE critical security step in the whole flow. A payment is
// never marked successful just because the browser says checkout
// finished; Razorpay's signature is recomputed here using the Key
// Secret and compared byte-for-byte. Only if that matches does this
// function activate the company's subscription and log the payment.
//
// Deploy with:
//   supabase functions deploy verify-razorpay-payment
//
// Needs RAZORPAY_KEY_SECRET set as a secret (see README at the bottom
// of create-razorpay-order/index.ts for the exact command).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Invalid session");

    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      company_id, plan_id, amount,
    } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !company_id || !plan_id) {
      throw new Error("Missing required fields");
    }

    // Confirm the caller genuinely belongs to the company they're
    // claiming to pay for — not strictly required for the signature
    // check itself, but stops one company's admin from activating a
    // DIFFERENT company using a payment they made for their own.
    const { data: emp } = await supabase
      .from("employees").select("company_id, role").eq("auth_id", userData.user.id).single();
    if (!emp || emp.company_id !== company_id) throw new Error("Company mismatch");
    if (emp.role !== "admin") throw new Error("Only a company admin can complete a subscription");

    // The actual verification: Razorpay's documented signature scheme
    // is HMAC-SHA256 of "order_id|payment_id" using the Key Secret.
    // Recomputing this ourselves, server-side, is the only way to trust
    // that this payment genuinely happened and wasn't just a client
    // claiming success.
    const expectedSignature = await hmacSha256Hex(
      RAZORPAY_KEY_SECRET,
      `${razorpay_order_id}|${razorpay_payment_id}`
    );
    if (expectedSignature !== razorpay_signature) {
      throw new Error("Payment signature verification failed");
    }

    const today = new Date();
    const periodEnd = new Date(today);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await supabase.from("payment_history").insert({
      company_id, amount: (amount || 0) / 100, currency: "INR", status: "paid",
      method: "razorpay", gateway_ref: razorpay_payment_id,
      period_start: today.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
    });

    await supabase.from("companies").update({
      plan_id, subscription_status: "active",
    }).eq("id", company_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
