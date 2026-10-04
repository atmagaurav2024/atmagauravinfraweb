// Polls a DigiLocker consent session started by digilocker-initiate.
// Once the person has granted consent, pulls their Aadhaar + PAN
// straight from DigiLocker via Sandbox.co.in, re-hosts each file on
// Cloudinary (so the app's existing document-link UI works unchanged),
// and marks the record Verified automatically — no human has to click
// "Mark Verified" for an auto-pulled record.
//
// Education certificates are NEVER touched here — Sandbox.co.in's
// DigiLocker API only exposes aadhaar / pan / driving_license, so that
// field stays manual-upload-only regardless of how this goes.
//
// Deploy: supabase functions deploy digilocker-check
//
// Response shapes the frontend should expect:
//   {success:true, status:"pending"}                                   — still waiting on the person
//   {success:true, status:"verified", aadhar_doc_url, pan_doc_url}      — done, at least one doc pulled
//   {success:true, status:"failed", reason}                            — DigiLocker session failed/expired
//   {success:false, error}                                             — our own error (bad request, not set up, etc.)

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

// Same unsigned preset the client already uses for every other upload
// in the app (uploadToCloudinary in index.html) — not a secret, that's
// how unsigned presets work, so hardcoding it here is fine.
const CLOUDINARY_CLOUD = "dlmezcwwu";
const CLOUDINARY_UPLOAD_PRESET = "aipl_unsigned";

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

async function rehostToCloudinary(fileUrl: string, docType: string, fetchOpts: any): Promise<string | null> {
  const fileRes = await fetch(fileUrl, fetchOpts);
  if (!fileRes.ok) {
    console.error("Could not download " + docType + " from DigiLocker, status " + fileRes.status);
    return null;
  }
  const contentType = fileRes.headers.get("content-type") || "application/pdf";
  const blob = await fileRes.blob();
  const form = new FormData();
  form.append("file", blob, docType + (contentType.includes("pdf") ? ".pdf" : ".jpg"));
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  form.append("folder", "kyc");
  const upRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/upload`, {
    method: "POST",
    body: form,
  });
  const upJson = await upRes.json();
  if (!upRes.ok || !upJson.secure_url) {
    console.error("Cloudinary re-host failed for " + docType + ":", JSON.stringify(upJson));
    return null;
  }
  return upJson.secure_url;
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
      .select("id, digilocker_session_id")
      .eq("id", record_id)
      .eq("company_id", caller.company_id)
      .single();
    if (!record) throw new Error("Record not found");
    if (!record.digilocker_session_id) {
      return new Response(JSON.stringify({ success: true, status: "failed", reason: "No verification in progress for this record" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sessionId = record.digilocker_session_id;

    const { data: kyc } = await supabaseAdmin
      .from("company_kyc_settings")
      .select("*")
      .eq("company_id", caller.company_id)
      .single();
    if (!kyc || !kyc.sandbox_api_key || !kyc.sandbox_api_secret) {
      throw new Error("DigiLocker verification not set up for this company");
    }
    const base = kyc.sandbox_env === "production"
      ? "https://api.sandbox.co.in"
      : "https://test-api.sandbox.co.in";

    var proxyClient = buildProxyClient();
    var fetchOpts = proxyClient ? { client: proxyClient } : {};
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
        throw new Error("DigiLocker authentication failed");
      }
      const accessToken = authJson.data.access_token;

      const statusRes = await fetch(base + "/kyc/digilocker/sessions/" + sessionId + "/status", {
        method: "GET",
        headers: { "Authorization": accessToken, "x-api-key": kyc.sandbox_api_key },
        ...fetchOpts,
      });
      const statusJson = await statusRes.json();
      // Logging this in full every call while this integration is new —
      // the exact field/value Sandbox.co.in uses to say "done" wasn't
      // confirmed in testing yet, so if auto-verify doesn't trigger,
      // check the Supabase Logs tab for this line first.
      console.log("DigiLocker session status response:", JSON.stringify(statusJson));
      const status = (statusJson?.data?.status || statusJson?.status || "").toLowerCase();

      if (!statusRes.ok || status === "failed" || status === "expired" || status === "rejected") {
        return new Response(JSON.stringify({ success: true, status: "failed", reason: statusJson?.message || "DigiLocker session " + (status || "failed") }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status !== "succeeded" && status !== "success" && status !== "completed") {
        return new Response(JSON.stringify({ success: true, status: "pending" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Consent granted — pull whichever of aadhaar/pan DigiLocker
      // actually has on file for this person (not guaranteed to have
      // both) and re-host each on Cloudinary.
      const updates: Record<string, any> = {};
      for (const docType of ["aadhaar", "pan"]) {
        try {
          const docRes = await fetch(base + "/kyc/digilocker/sessions/" + sessionId + "/documents/" + docType, {
            method: "GET",
            headers: { "Authorization": accessToken, "x-api-key": kyc.sandbox_api_key },
            ...fetchOpts,
          });
          const docJson = await docRes.json();
          const fileUrl = docJson?.data?.files?.[0]?.url;
          if (docRes.ok && fileUrl) {
            const hostedUrl = await rehostToCloudinary(fileUrl, docType, fetchOpts);
            if (hostedUrl) updates[docType === "aadhaar" ? "aadhar_doc_url" : "pan_doc_url"] = hostedUrl;
          } else {
            console.error("No " + docType + " available from this DigiLocker session:", JSON.stringify(docJson));
          }
        } catch (docErr) {
          console.error("Error fetching " + docType + " document:", docErr.message);
        }
      }

      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ success: true, status: "failed", reason: "DigiLocker consent completed but no documents could be retrieved" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      updates.kyc_status = "verified";
      updates.kyc_verified_by = "DigiLocker (auto-verified)";
      updates.kyc_verified_at = new Date().toISOString();
      updates.kyc_remarks = null;
      updates.digilocker_session_id = null;
      await supabaseAdmin.from(table).update(updates).eq("id", record_id);

      return new Response(JSON.stringify({ success: true, status: "verified", aadhar_doc_url: updates.aadhar_doc_url || null, pan_doc_url: updates.pan_doc_url || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      if (proxyClient) proxyClient.close();
    }
  } catch (error) {
    console.error("digilocker-check error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
