// supabase/functions/create-razorpay-order/index.ts
//
// Creates a Razorpay order for the caller's own company to subscribe
// to a plan. Runs server-side (Supabase Edge Function / Deno) because
// creating an order requires the Razorpay Key Secret, which must never
// be embedded in client-side code — anyone could view-source a static
// site and steal it.
//
// Deploy with:
//   supabase functions deploy create-razorpay-order
//
// Needs these secrets set once (see README at the bottom of this file
// for the exact commands):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically
// by the Edge Functions runtime — nothing to set for those.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const token = authHeader.replace("Bearer ", "");

    // Service role client — this function does its own authorization
    // checks below rather than relying on RLS, since it legitimately
    // needs to read the plan and (in verify-razorpay-payment) write to
    // companies/payment_history regardless of the caller's own RLS scope.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Invalid session");

    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("company_id, role")
      .eq("auth_id", userData.user.id)
      .single();
    if (empErr || !emp) throw new Error("No matching employee record for this session");
    if (emp.role !== "admin") throw new Error("Only a company admin can subscribe");

    const { plan_id } = await req.json();
    if (!plan_id) throw new Error("plan_id is required");

    const { data: plan, error: planErr } = await supabase
      .from("plans").select("*").eq("id", plan_id).single();
    if (planErr || !plan) throw new Error("Plan not found");

    const amountPaise = Math.round(Number(plan.price_monthly) * 100);
    if (amountPaise <= 0) throw new Error("This plan has no cost — nothing to pay");

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `co_${emp.company_id}_${Date.now()}`,
        notes: { company_id: emp.company_id, plan_id: plan.id, plan_name: plan.name },
      }),
    });
    const order = await orderRes.json();
    if (!orderRes.ok) throw new Error(order.error?.description || "Razorpay order creation failed");

    return new Response(JSON.stringify({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
      company_id: emp.company_id,
      plan_id: plan.id,
      plan_name: plan.name,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
