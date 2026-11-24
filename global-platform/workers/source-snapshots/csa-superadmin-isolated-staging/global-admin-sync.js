// CSA Global admin authorization sync sender.
// Import this helper into the CSA Super Admin Worker and call it only after
// an authenticated Super Admin changes an account or accepts an invitation.
// Prefer GLOBAL_API_SYNC_HMAC_SECRET for canonical Staging bridges.
// Legacy Links uses ADMIN_SYNC_HMAC_SECRET on the isolated API. Never expose either secret to browser code.
const encoder = new TextEncoder();

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function syncGlobalAdminAuthorizations(env) {
  if (!env.CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET) throw new Error("admin_sync_secret_missing");
  if (!env.DB) throw new Error("superadmin_database_binding_missing");

  const result = await env.DB.prepare(
    "SELECT a.id,a.email,a.role,a.status,COALESCE((SELECT m.access_level FROM csa_admin_module_access m WHERE m.admin_id=a.id AND m.module_key='finance'),'none') AS finance_access_level FROM admin_accounts a ORDER BY a.id",
  ).all();

  // Pending invitations are intentionally omitted: they receive no Global access.
  // The receiver revokes records absent from this authoritative snapshot.
  const snapshot = (result.results || [])
    .filter((account) => account.status !== "pending" && account.role !== "super_admin")
    .map((account) => ({
      source_admin_id: account.id,
      email: String(account.email || "").trim().toLowerCase(),
      source_role: account.role,
      finance_access_level: account.role === "finance_admin" ? (account.finance_access_level === "none" ? "none" : ["read","write","manage"].includes(account.finance_access_level) ? "read" : "none") : "none",
      status:
        account.status === "active"
          ? "active"
          : account.status === "suspended"
            ? "suspended"
            : "revoked",
    }));

  const path = "/internal/admin-authorizations/sync";
  const body = JSON.stringify(snapshot);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const canonical = [
    "POST",
    path,
    timestamp,
    nonce,
    await sha256Hex(body),
  ].join("\n");
  const signature = await hmacHex(env.CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET, canonical);

  const response = await fetch(
    (env.ENVIRONMENT === "production" ? "https://csa-global-api.creatorsupportamravati.workers.dev" : "https://csa-global-api-staging.creatorsupportamravati.workers.dev") + path,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csa-sync-timestamp": timestamp,
        "x-csa-sync-nonce": nonce,
        "x-csa-sync-signature": signature,
      },
      body,
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) {
    throw new Error("global_authorization_sync_failed_" + response.status);
  }
  return { synced: Number(payload.synced || 0) };
}

export async function callGlobalPricingPolicy(env,payload){
 if(env.ENVIRONMENT!=="staging")throw new Error("pricing_bridge_staging_only");
 if(!(env.GLOBAL_API_SYNC_HMAC_SECRET||env.ADMIN_SYNC_HMAC_SECRET))throw new Error("pricing_bridge_secret_missing");
 const path="/internal/superadmin/pricing-policy",body=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID();
 const canonical=["POST",path,timestamp,nonce,await sha256Hex(body)].join("\n");
 const signature=await hmacHex(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET,canonical);
 const response=await fetch("https://csa-global-api-staging.creatorsupportamravati.workers.dev"+path,{method:"POST",headers:{"content-type":"application/json","x-csa-sync-timestamp":timestamp,"x-csa-sync-nonce":nonce,"x-csa-sync-signature":signature},body});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true)throw new Error("global_pricing_bridge_failed_"+response.status);
 return data;
}


export async function callGlobalRefundDashboard(env, actor, request={}) {
  if (env.ENVIRONMENT !== 'staging') throw new Error('refund_dashboard_bridge_staging_only');
  if (!(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET)) throw new Error('refund_dashboard_bridge_secret_missing');
  const path = '/internal/superadmin/finance/refund-dashboard';
  const body = JSON.stringify({...request,actor_admin_id:String(actor?.id||''),actor_email:String(actor?.email||'').trim().toLowerCase(),actor_role:String(actor?.role||'')});
  const timestamp = String(Math.floor(Date.now()/1000));
  const nonce = crypto.randomUUID();
  const canonical = ['POST',path,timestamp,nonce,await sha256Hex(body)].join('\n');
  const signature = await hmacHex(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET,canonical);
  const response = await fetch('https://csa-global-api-staging.creatorsupportamravati.workers.dev'+path,{method:'POST',headers:{'content-type':'application/json','x-csa-sync-timestamp':timestamp,'x-csa-sync-nonce':nonce,'x-csa-sync-signature':signature},body});
  const data = await response.json().catch(()=>({}));
  if (!response.ok || data.ok !== true) throw new Error('global_refund_dashboard_bridge_failed_'+response.status);
  return data;
}


export async function callGlobalEditorSessions(env, actor, request) {
 if (env.ENVIRONMENT !== "staging") throw new Error("editor_sessions_bridge_staging_only");
 if (!(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET)) throw new Error("editor_sessions_bridge_secret_missing");
 const path = "/internal/superadmin/editor-sessions";
 const body = JSON.stringify({actor_admin_id:String(actor?.id||""),actor_email:String(actor?.email||"").trim().toLowerCase(),actor_role:String(actor?.role||""),editor_id:String(request?.editor_id||""),action:String(request?.action||""),session_ref:String(request?.session_ref||"")});
 const timestamp = String(Math.floor(Date.now()/1000));
 const nonce = crypto.randomUUID();
 const canonical = ["POST",path,timestamp,nonce,await sha256Hex(body)].join("\n");
 const signature = await hmacHex(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET,canonical);
 const response = await fetch("https://csa-global-api-staging.creatorsupportamravati.workers.dev"+path,{method:"POST",headers:{"content-type":"application/json","x-csa-sync-timestamp":timestamp,"x-csa-sync-nonce":nonce,"x-csa-sync-signature":signature},body});
 const data = await response.json().catch(()=>({}));
 if (!response.ok || data.ok !== true) throw new Error("global_editor_sessions_bridge_failed_"+response.status);
 return data;
}

export async function callGlobalLegacyLinks(env,actor,request){
 if(env.ENVIRONMENT!=="staging")throw new Error("legacy_links_bridge_staging_only");
 if(!env.ADMIN_SYNC_HMAC_SECRET)throw new Error("legacy_links_bridge_secret_missing");
 const path="/internal/superadmin/legacy-links";
 const body=JSON.stringify({...request,actor_admin_id:String(actor?.id||""),actor_email:String(actor?.email||"").trim().toLowerCase(),actor_role:String(actor?.role||"")});
 const timestamp=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID();
 const canonical=["POST",path,timestamp,nonce,await sha256Hex(body)].join("\n");
 const signature=await hmacHex(env.ADMIN_SYNC_HMAC_SECRET,canonical);
 const response=await fetch("https://csa-global-api-isolated-staging.creatorsupportamravati.workers.dev"+path,{method:"POST",headers:{"content-type":"application/json","x-csa-sync-timestamp":timestamp,"x-csa-sync-nonce":nonce,"x-csa-sync-signature":signature},body});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true)throw new Error("global_legacy_links_bridge_failed_"+response.status);
 return data;
}
