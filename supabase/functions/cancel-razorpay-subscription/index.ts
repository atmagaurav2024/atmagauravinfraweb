// supabase/functions/cancel-razorpay-subscription/index.ts
//
// Cancels the caller's company's autopay subscription. Uses
// cancel_at_cycle_end: 1 — the company keeps access through the
// period they've already paid for, and simply isn't charged again
// afterward, rather than losing access immediately. The webhook's
// subscription.cancelled handler is what actually flips
// subscription_status once Razorpay processes it.
//
// Deploy with:
//   supabase functions deploy cancel-razorpay-subscription

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

    const { data: emp } = await supabase
      .from("employees").select("company_id, role").eq("auth_id", userData.user.id).single();
    if (!emp) throw new Error("No matching employee record for this session");
    if (emp.role !== "admin") throw new Error("Only a company admin can cancel a subscription");

    const { data: company } = await supabase
      .from("companies").select("razorpay_subscription_id").eq("id", emp.company_id).single();
    if (!company?.razorpay_subscription_id) throw new Error("No active autopay subscription found");

    const cancelRes = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${company.razorpay_subscription_id}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
        },
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
      }
    );
    const result = await cancelRes.json();
    if (!cancelRes.ok) throw new Error(result.error?.description || "Cancellation failed");

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
