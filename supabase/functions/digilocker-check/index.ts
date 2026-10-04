// Polls a DigiLocker consent session started by digilocker-initiate.
// Once the person has granted consent, pulls their Aadhaar + PAN
// straight from DigiLocker via Sandbox.co.in, CONFIRMS the name (and,
// for employees, date of birth) on those documents actually matches
// what's on this record, re-hosts each file on Cloudinary for the
// record (so the app's existing document-link UI works unchanged),
// and only THEN marks the record Verified automatically.
//
// That name/DOB check is the whole point of doing this automatically —
// without it, completing DigiLocker consent as ANYONE (including
// whoever clicked the button) would mark ANY record Verified, which
// defeats the purpose of KYC entirely. digilocker-initiate already
// refuses to start a session until name_as_per_pan is filled in, so by
// the time this runs there's always something to check against.
//
// Education certificates are NEVER touched here — Sandbox.co.in's
// DigiLocker API only exposes aadhaar / pan / driving_license, so that
// field stays manual-upload-only regardless of how this goes.
//
// Aadhaar's XML also carries a <Pht> base64 photo (PAN's record has no
// photo at all) — pulled out, re-hosted, and on an actual name/DOB
// match also copied onto the employee's profile_photo (vendors,
// subcontractors and labourers have no profile photo field in this app
// today, so for them it's only stored on kyc_photo_url).
//
// Deploy: supabase functions deploy digilocker-check
//
// Response shapes the frontend should expect:
//   {success:true, status:"pending"}                                                        — still waiting on the person
//   {success:true, status:"verified", kyc_photo_url, profile_photo, aadhar_doc_url, pan_doc_url} — matched, done
//   {success:true, status:"rejected", reason, kyc_photo_url, ...}                            — name/DOB mismatch, record updated for manual review
//   {success:true, status:"failed", reason}                                                  — session itself failed/expired, nothing written
//   {success:false, error}                                                                   — our own error (bad request, not set up, etc.)

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

// Pulls attribute="value" pairs out of one XML tag's source text — used
// instead of a real XML parser since Deno's std lib doesn't ship one
// and the two tags we care about (<Poi .../> for Aadhaar, <Person .../>
// for PAN) are simple, attribute-only, self-closing tags. Attribute
// order varies between the two, so this doesn't assume a fixed order.
function parseAttrs(tagSrc: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tagSrc))) out[m[1]] = m[2];
  return out;
}

// Aadhaar XML: <UidData ...><Poi dob=".." gender=".." name=".."/> ...
// PAN XML:     <IssuedTo><Person uid=".." name=".." dob=".." gender=".."/></IssuedTo>
// Sandbox.co.in's own docs confirm both come back as signed XML (not a
// scanned PDF/image) — see developer.sandbox.co.in's DigiLocker sample
// responses.
function extractIdentity(docType: string, xmlText: string): { name: string | null; dob: string | null } {
  const tagRe = docType === "aadhaar" ? /<Poi\b[^>]*\/?>/i : /<Person\b[^>]*\/?>/i;
  const m = tagRe.exec(xmlText);
  if (!m) return { name: null, dob: null };
  const attrs = parseAttrs(m[0]);
  return { name: attrs.name || null, dob: attrs.dob || null };
}

// Only Aadhaar's XML carries a photo (<Pht>base64...</Pht> under
// <UidData>, per Sandbox.co.in's own sample) - PAN's record has no
// photo field at all. Returns decoded JPEG bytes, or null if the tag is
// missing/empty (consent scope can exclude the photo even when the rest
// of Aadhaar is returned).
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

// Loose but deliberate normalization — DigiLocker names are in ALL CAPS
// with sometimes-different spacing/punctuation than however the typed
// name_as_per_pan was entered, so compare on letters only, case- and
// spacing-insensitive, rather than requiring a byte-for-byte match.
function normName(s: string): string {
  return (s || "").toUpperCase().replace(/[^A-Z]/g, "");
}
// Dates may arrive as DD-MM-YYYY (UIDAI's usual e-KYC format) or
// YYYY-MM-DD (the <input type=date> format this app stores) — compare
// on digits only in a fixed D/M/Y order rather than trusting either
// side's separators or field order to already match.
function normDob(s: string): string | null {
  if (!s) return null;
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length !== 8) return null;
  // YYYY-MM-DD (starts with a plausible year) vs DD-MM-YYYY
  if (/^\d{4}/.test(s.trim()) && parseInt(s.slice(0, 4), 10) > 1900) {
    return digits; // already YYYYMMDD
  }
  return digits.slice(4, 8) + digits.slice(2, 4) + digits.slice(0, 2); // DDMMYYYY -> YYYYMMDD
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
    // date_of_birth only exists on employees — selected conditionally so
    // this doesn't error out on vendors/subcontractors/labourers, which
    // have no DOB field and so only ever get the name check.
    const selectCols = "id, digilocker_session_id, name_as_per_pan" + (record_type === "employee" ? ", date_of_birth" : "");
    const { data: record } = await supabaseAdmin
      .from(table)
      .select(selectCols)
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
      // both), extract the name/DOB printed on each, and re-host each
      // file on Cloudinary. Document storage is kept separate from the
      // identity check below: if Cloudinary re-hosting fails for some
      // reason, that's logged and surfaced, but it never by itself
      // blocks or grants Verified — only the name/DOB match does.
      const docUpdates: Record<string, any> = {};
      var pulledName: string | null = null, pulledDob: string | null = null, pulledPhotoUrl: string | null = null;
      var storageIssues: string[] = [];
      for (const docType of ["aadhaar", "pan"]) {
        try {
          const docRes = await fetch(base + "/kyc/digilocker/sessions/" + sessionId + "/documents/" + docType, {
            method: "GET",
            headers: { "Authorization": accessToken, "x-api-key": kyc.sandbox_api_key },
            ...fetchOpts,
          });
          const docJson = await docRes.json();
          const fileUrl = docJson?.data?.files?.[0]?.url;
          const metaContentType = docJson?.data?.files?.[0]?.metadata?.ContentType;
          if (!docRes.ok || !fileUrl) {
            console.error("No " + docType + " available from this DigiLocker session:", JSON.stringify(docJson));
            continue;
          }
          const fileRes = await fetch(fileUrl, fetchOpts);
          if (!fileRes.ok) { storageIssues.push(docType + " (download failed)"); continue; }
          const contentType = metaContentType || fileRes.headers.get("content-type") || "application/octet-stream";
          const bytes = new Uint8Array(await fileRes.arrayBuffer());

          if (contentType.indexOf("xml") > -1) {
            const xmlText = new TextDecoder().decode(bytes);
            const identity = extractIdentity(docType, xmlText);
            // Prefer Aadhaar's name/DOB when both documents were pulled
            // (UIDAI's own record), falling back to PAN's.
            if (identity.name && !pulledName) pulledName = identity.name;
            if (identity.dob && !pulledDob) pulledDob = identity.dob;
            // Only Aadhaar's XML carries a photo - PAN's record has none.
            if (docType === "aadhaar") {
              const photoBytes = extractAadhaarPhoto(xmlText);
              if (photoBytes) {
                const photoUrl = await rehostToCloudinary(photoBytes, "aadhaar_photo.jpg", "image/jpeg", fetchOpts);
                if (photoUrl) pulledPhotoUrl = photoUrl;
                else storageIssues.push("photo (could not be stored)");
              }
            }
          }

          const ext = contentType.indexOf("xml") > -1 ? ".xml" : contentType.indexOf("pdf") > -1 ? ".pdf" : contentType.indexOf("png") > -1 ? ".png" : ".jpg";
          const hostedUrl = await rehostToCloudinary(bytes, docType + ext, contentType, fetchOpts);
          if (hostedUrl) docUpdates[docType === "aadhaar" ? "aadhar_doc_url" : "pan_doc_url"] = hostedUrl;
          else storageIssues.push(docType + " (could not be stored)");
        } catch (docErr) {
          console.error("Error fetching " + docType + " document:", docErr.message);
          storageIssues.push(docType + " (error: " + docErr.message + ")");
        }
      }
      if (pulledPhotoUrl) docUpdates.kyc_photo_url = pulledPhotoUrl;

      if (!pulledName) {
        return new Response(JSON.stringify({ success: true, status: "failed", reason: "DigiLocker consent completed but no readable Aadhaar/PAN name could be pulled — try again, or verify manually" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── The actual identity check ──────────────────────────────────
      const onFileName = record.name_as_per_pan || "";
      const nameMatches = normName(pulledName) === normName(onFileName);
      var dobMatches = true, dobChecked = false;
      if (record_type === "employee" && record.date_of_birth && pulledDob) {
        dobChecked = true;
        dobMatches = normDob(pulledDob) === normDob(record.date_of_birth);
      }

      const updates: Record<string, any> = {
        ...docUpdates,
        kyc_digilocker_name: pulledName,
        kyc_digilocker_dob: pulledDob,
        kyc_verified_at: new Date().toISOString(),
        digilocker_session_id: null,
      };

      if (!nameMatches || !dobMatches) {
        updates.kyc_status = "rejected";
        updates.kyc_verified_by = "DigiLocker (auto-check)";
        updates.kyc_remarks = "Automatic mismatch — DigiLocker returned \"" + pulledName + "\"" +
          (dobChecked ? " (DOB " + pulledDob + ")" : "") +
          ", but this record has \"" + onFileName + "\"" +
          (dobChecked ? " (DOB " + record.date_of_birth + ")" : "") +
          ". Check the pulled document(s) below and either fix the name/DOB on file and retry, or verify manually if it's genuinely the same person.";
        await supabaseAdmin.from(table).update(updates).eq("id", record_id);
        // Distinct from "failed" below: the record WAS updated (marked
        // Rejected with the mismatch written into kyc_remarks, plus
        // whatever documents did get pulled), so the frontend should
        // refresh/reopen the form rather than just show an error toast.
        return new Response(JSON.stringify({
          success: true, status: "rejected", reason: updates.kyc_remarks,
          kyc_digilocker_name: pulledName, kyc_digilocker_dob: pulledDob, kyc_photo_url: pulledPhotoUrl,
          aadhar_doc_url: docUpdates.aadhar_doc_url || null, pan_doc_url: docUpdates.pan_doc_url || null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      updates.kyc_status = "verified";
      updates.kyc_verified_by = "DigiLocker (auto-verified)";
      updates.kyc_remarks = storageIssues.length ? ("Identity matched via DigiLocker, but could not store: " + storageIssues.join(", ")) : null;
      // Aadhaar's photo is a verified government ID photo pulled at the
      // moment of a confirmed name/DOB match - a good, trustworthy
      // default for the employee's profile picture. Only done for
      // employees (the only type with a profile photo today) and only
      // on an actual match, never on a rejected one.
      if (record_type === "employee" && pulledPhotoUrl) updates.profile_photo = pulledPhotoUrl;
      await supabaseAdmin.from(table).update(updates).eq("id", record_id);

      return new Response(JSON.stringify({
        success: true, status: "verified",
        kyc_digilocker_name: pulledName, kyc_digilocker_dob: pulledDob, kyc_photo_url: pulledPhotoUrl,
        profile_photo: updates.profile_photo || null,
        aadhar_doc_url: docUpdates.aadhar_doc_url || null, pan_doc_url: docUpdates.pan_doc_url || null,
      }), {
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
