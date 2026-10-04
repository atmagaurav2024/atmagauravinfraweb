// Starts a DigiLocker consent session for a brand-new employee who
// doesn't exist as a database row yet — used by the "Fetch from
// DigiLocker" option on the Add New Employee form, as an alternative
// to typing in name/DOB/documents by hand.
//
// Unlike digilocker-initiate (which attaches the session to an
// existing employee/vendor/subcontractor/labour row and later checks
// the pulled documents against that row's name), there's nothing to
// attach to or compare against here — the person completing DigiLocker
// consent IS, by definition, who's being registered. So this never
// writes to any table; it just authenticates with the company's own
// Sandbox.co.in account and returns the session straight to the
// browser, which holds session_id itself (in memory, for the one
// "Add New Employee" form it was started from) and polls
// digilocker-check-new with it directly.
//
// Deploy: supabase functions deploy digilocker-initiate-new

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REDIRECT_URL = "https://app.rydax.in/digilocker-callback.html";

function buildProxyClient(): Deno.HttpClient | undefined {
  const proxyUrl = Deno.env.get("DIGILOCKER_PROXY_URL");
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: caller } = await supabaseAdmin
      .from("employees")
      .select("company_id")
      .eq("auth_id", user.id)
      .single();
    if (!caller?.company_id) throw new Error("Could not resolve company");

    const { data: kyc } = await supabaseAdmin
      .from("company_kyc_settings")
      .select("*")
      .eq("company_id", caller.company_id)
      .single();
    if (!kyc || !kyc.is_active || !kyc.sandbox_api_key || !kyc.sandbox_api_secret) {
      throw new Error("DigiLocker verification not set up for this company yet — add your Sandbox.co.in API key in Company Settings first");
    }

    const base = kyc.sandbox_env === "production"
      ? "https://api.sandbox.co.in"
      : "https://test-api.sandbox.co.in";

    var proxyClient = buildProxyClient();
    var fetchOpts = proxyClient ? { client: proxyClient } : {};
    var sessionId: string, authorizationUrl: string;
    try {
      const authRes = await fetch(base + "/authenticate", {
        method: "POST",
        headers: {
          "x-api-key": kyc.sandbox_api_key,
          "x-api-secret": kyc.sandbox_api_secret,
          "x-api-version": "1.0.0",
        },
        ...fetchOpts,
      });
      const authJson = await authRes.json();
      if (!authRes.ok || !authJson?.data?.access_token) {
        console.error("Sandbox.co.in authenticate error, full response:", JSON.stringify(authJson));
        throw new Error(authJson?.message || "DigiLocker authentication failed — check the API key/secret in Company Settings");
      }
      const accessToken = authJson.data.access_token;

      const initRes = await fetch(base + "/kyc/digilocker/sessions/init", {
        method: "POST",
        headers: {
          "Authorization": accessToken,
          "x-api-key": kyc.sandbox_api_key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "@entity": "in.co.sandbox.kyc.digilocker.session.request",
          flow: "signin",
          doc_types: ["aadhaar", "pan"],
          redirect_url: REDIRECT_URL,
        }),
        ...fetchOpts,
      });
      const initJson = await initRes.json();
      if (!initRes.ok || !initJson?.data?.session_id) {
        console.error("Sandbox.co.in session init error, full response:", JSON.stringify(initJson));
        throw new Error(initJson?.message || "Could not start DigiLocker verification");
      }
      sessionId = initJson.data.session_id;
      authorizationUrl = initJson.data.authorization_url;
    } finally {
      if (proxyClient) proxyClient.close();
    }

    return new Response(JSON.stringify({ success: true, authorization_url: authorizationUrl, session_id: sessionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("digilocker-initiate-new error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
