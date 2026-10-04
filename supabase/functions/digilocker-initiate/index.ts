// Starts a real DigiLocker consent session via Sandbox.co.in (the
// company's own account — sandbox.co.in, not to be confused with "test
// mode"). DigiLocker itself only hands out direct document-pull access
// to a certified "Requestor Organization" through a paid Technology
// Solution Provider — there's no way around that, so this always runs
// through the company's own Sandbox.co.in credentials, server-side.
//
// Called from the app when someone with edit access clicks "Verify
// Instantly via DigiLocker" on an employee/vendor/subcontractor/labour
// record. Returns a DigiLocker authorization_url — the PERSON BEING
// VERIFIED (not necessarily whoever clicked the button) opens that URL
// and logs into DigiLocker with their OWN Aadhaar-linked mobile OTP to
// grant consent. The app then polls digilocker-check until that
// consent completes and the documents are pulled.
//
// Deploy: supabase functions deploy digilocker-initiate
//
// If Sandbox.co.in ever turns out to also require IP whitelisting (like
// Cashfree did), the same free Webshare.io proxy already set up for
// Cashfree payouts can be reused here — just set DIGILOCKER_PROXY_URL
// to the same value as CASHFREE_PROXY_URL. Try without it first.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES: Record<string, string> = {
  employee: "employees",
  vendor: "vendors",
  sc: "subcontractors",
  labour: "labourers",
};

// Where DigiLocker sends the person back to after they grant (or
// decline) consent — a tiny static page, not the main app, so this
// never has to restore a login session on redirect. The app finds out
// the outcome by polling digilocker-check instead of relying on this
// redirect at all, so the callback page itself only needs to tell the
// person they can close the tab.
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
    const { record_type, record_id } = await req.json();
    if (!record_type || !TABLES[record_type]) throw new Error("Invalid record_type");
    if (!record_id) throw new Error("record_id is required");

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

    const table = TABLES[record_type];
    const { data: record } = await supabaseAdmin
      .from(table)
      .select("id")
      .eq("id", record_id)
      .eq("company_id", caller.company_id) // tenant safety, belt & suspenders alongside RLS
      .single();
    if (!record) throw new Error("Record not found");

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
      // 1) Authenticate — exchange the API key/secret for a short-lived
      // access token. Sandbox.co.in's docs say this is NOT a bearer
      // token: it goes in the Authorization header with no "Bearer "
      // prefix.
      const authRes = await fetch(base + "/authenticate", {
        method: "POST",
        headers: {
          "x-api-key": kyc.sandbox_api_key,
          "x-api-secret": kyc.sandbox_api_secret,
          "x-api-version": "1.0",
        },
        ...fetchOpts,
      });
      const authJson = await authRes.json();
      if (!authRes.ok || !authJson?.data?.access_token) {
        console.error("Sandbox.co.in authenticate error, full response:", JSON.stringify(authJson));
        throw new Error(authJson?.message || "DigiLocker authentication failed — check the API key/secret in Company Settings");
      }
      const accessToken = authJson.data.access_token;

      // 2) Create the consent session. Only aadhaar + pan are requested
      // — this API doesn't support pulling education certificates at
      // all (confirmed from its own docs), so those stay manual-upload.
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

    await supabaseAdmin
      .from(table)
      .update({ digilocker_session_id: sessionId })
      .eq("id", record_id);

    return new Response(JSON.stringify({ success: true, authorization_url: authorizationUrl, session_id: sessionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("digilocker-initiate error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
