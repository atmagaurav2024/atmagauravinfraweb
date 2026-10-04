// Polls a session started by digilocker-initiate-new — the "Fetch from
// DigiLocker" option on the Add New Employee form, for a person who
// doesn't exist as a database row yet.
//
// No identity check here (unlike digilocker-check): there's no
// existing name/DOB on file to compare against — the person who
// completes DigiLocker consent simply IS who's being registered. This
// just pulls whatever Aadhaar/PAN gives back and hands it straight to
// the browser to drop into the new-employee form's fields for the
// admin to review before saving. Nothing is written to any table.
//
// Deploy: supabase functions deploy digilocker-check-new
//
// Response shapes the frontend should expect:
//   {success:true, status:"pending"}
//   {success:true, status:"verified", name, dob, photo_url, aadhar_doc_url, pan_doc_url}
//   {success:true, status:"failed", reason}
//   {success:false, error}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function parseAttrs(tagSrc: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tagSrc))) out[m[1]] = m[2];
  return out;
}
function extractIdentity(docType: string, xmlText: string): { name: string | null; dob: string | null } {
  const tagRe = docType === "aadhaar" ? /<Poi\b[^>]*\/?>/i : /<Person\b[^>]*\/?>/i;
  const m = tagRe.exec(xmlText);
  if (!m) return { name: null, dob: null };
  const attrs = parseAttrs(m[0]);
  return { name: attrs.name || null, dob: attrs.dob || null };
}
function extractAadhaarPhoto(xmlText: string): Uint8Array | null {
  const m = /<Pht[^>]*>([\s\S]*?)<\/Pht>/i.exec(xmlText);
  const b64 = m && m[1] ? m[1].replace(/\s+/g, "") : "";
  if (!b64) return null;
  try {
    const binStr = atob(b64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    return bytes;
  } catch (e) {
    console.error("Could not decode Aadhaar photo base64:", e.message);
    return null;
  }
}
async function rehostToCloudinary(bytes: Uint8Array, filename: string, contentType: string, fetchOpts: any): Promise<string | null> {
  const blob = new Blob([bytes], { type: contentType });
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  form.append("folder", "aipl/kyc");
  const upRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/upload`, {
    method: "POST",
    body: form,
    ...fetchOpts,
  });
  const upJson = await upRes.json();
  if (!upRes.ok || !upJson.secure_url) {
    console.error("Cloudinary re-host failed for " + filename + ":", JSON.stringify(upJson));
    return null;
  }
  return upJson.secure_url;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id is required");

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

      const statusRes = await fetch(base + "/kyc/digilocker/sessions/" + session_id + "/status", {
        method: "GET",
        headers: { "Authorization": accessToken, "x-api-key": kyc.sandbox_api_key },
        ...fetchOpts,
      });
      const statusJson = await statusRes.json();
      console.log("DigiLocker session status response (new-employee fetch):", JSON.stringify(statusJson));
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

      var pulledName: string | null = null, pulledDob: string | null = null, pulledPhotoUrl: string | null = null;
      var aadharDocUrl: string | null = null, panDocUrl: string | null = null;
      for (const docType of ["aadhaar", "pan"]) {
        try {
          const docRes = await fetch(base + "/kyc/digilocker/sessions/" + session_id + "/documents/" + docType, {
            method: "GET",
            headers: { "Authorization": accessToken, "x-api-key": kyc.sandbox_api_key },
            ...fetchOpts,
          });
          const docJson = await docRes.json();
          const fileUrl = docJson?.data?.files?.[0]?.url;
          const metaContentType = docJson?.data?.files?.[0]?.metadata?.ContentType;
          if (!docRes.ok || !fileUrl) { console.error("No " + docType + " available:", JSON.stringify(docJson)); continue; }
          const fileRes = await fetch(fileUrl, fetchOpts);
          if (!fileRes.ok) continue;
          const contentType = metaContentType || fileRes.headers.get("content-type") || "application/octet-stream";
          const bytes = new Uint8Array(await fileRes.arrayBuffer());

          if (contentType.indexOf("xml") > -1) {
            const xmlText = new TextDecoder().decode(bytes);
            const identity = extractIdentity(docType, xmlText);
            if (identity.name && !pulledName) pulledName = identity.name;
            if (identity.dob && !pulledDob) pulledDob = identity.dob;
            if (docType === "aadhaar") {
              const photoBytes = extractAadhaarPhoto(xmlText);
              if (photoBytes) pulledPhotoUrl = await rehostToCloudinary(photoBytes, "aadhaar_photo.jpg", "image/jpeg", fetchOpts);
            }
          }

          const ext = contentType.indexOf("xml") > -1 ? ".xml" : contentType.indexOf("pdf") > -1 ? ".pdf" : contentType.indexOf("png") > -1 ? ".png" : ".jpg";
          const hostedUrl = await rehostToCloudinary(bytes, docType + ext, contentType, fetchOpts);
          if (docType === "aadhaar") aadharDocUrl = hostedUrl; else panDocUrl = hostedUrl;
        } catch (docErr) {
          console.error("Error fetching " + docType + " document:", docErr.message);
        }
      }

      if (!pulledName) {
        return new Response(JSON.stringify({ success: true, status: "failed", reason: "DigiLocker consent completed but no readable name could be pulled — try again, or enter details manually" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true, status: "verified",
        name: pulledName, dob: pulledDob, photo_url: pulledPhotoUrl,
        aadhar_doc_url: aadharDocUrl, pan_doc_url: panDocUrl,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      if (proxyClient) proxyClient.close();
    }
  } catch (error) {
    console.error("digilocker-check-new error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
