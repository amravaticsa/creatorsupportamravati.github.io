// CSA Global admin authorization sync sender.
// Import this helper into the CSA Super Admin Worker and call it only after
// an authenticated Super Admin changes an account or accepts an invitation.
// The shared HMAC secret must be configured as ADMIN_SYNC_HMAC_SECRET on
// BOTH staging Workers. Never expose the secret to browser code.
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
  if (!env.ADMIN_SYNC_HMAC_SECRET) throw new Error("admin_sync_secret_missing");
  if (!env.DB) throw new Error("superadmin_database_binding_missing");

  const result = await env.DB.prepare(
    "SELECT id,email,role,status FROM admin_accounts ORDER BY id",
  ).all();

  // Pending invitations are intentionally omitted: they receive no Global access.
  // The receiver revokes records absent from this authoritative snapshot.
  const snapshot = (result.results || [])
    .filter((account) => account.status !== "pending")
    .map((account) => ({
      source_admin_id: account.id,
      email: String(account.email || "").trim().toLowerCase(),
      source_role: account.role,
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
  const signature = await hmacHex(env.ADMIN_SYNC_HMAC_SECRET, canonical);

  const response = await fetch(
    "https://csa-global-api-staging.creatorsupportamravati.workers.dev" + path,
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
