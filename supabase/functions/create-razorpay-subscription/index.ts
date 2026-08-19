// supabase/functions/create-razorpay-subscription/index.ts
//
// Replaces create-razorpay-order for autopay billing. Creates a
// Razorpay Subscription (linked to a Razorpay Plan configured against
// the app's own plan row) rather than a one-time Order — this is what
// lets the checkout set up UPI Autopay / a card mandate, so Razorpay
// charges the company automatically every billing cycle afterward
// without them ever checking out again.
//
// Deploy with:
//   supabase functions deploy create-razorpay-subscription
//
// Needs RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET set (same secrets the
// one-time flow already used).

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
    if (Number(plan.price_monthly) <= 0) throw new Error("This plan has no cost — nothing to subscribe to");
    if (!plan.razorpay_plan_id) {
      throw new Error("This plan isn't set up for autopay yet — a Razorpay Plan ID needs to be configured against it first");
    }

    // total_count is required by Razorpay's API — there's no true
    // "until cancelled" option, so 120 monthly cycles (10 years) is
    // used as an effectively-indefinite subscription; a company can
    // cancel any time via cancel-razorpay-subscription regardless.
    const subRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
      },
      body: JSON.stringify({
        plan_id: plan.razorpay_plan_id,
        customer_notify: 1,
        total_count: 120,
        notes: { company_id: emp.company_id, plan_id: plan.id, plan_name: plan.name },
      }),
    });
    const subscription = await subRes.json();
    if (!subRes.ok) throw new Error(subscription.error?.description || "Razorpay subscription creation failed");

    return new Response(JSON.stringify({
      subscription_id: subscription.id,
      key_id: RAZORPAY_KEY_ID,
      company_id: emp.company_id,
      plan_id: plan.id,
      plan_name: plan.name,
      amount: Math.round(Number(plan.price_monthly) * 100),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
