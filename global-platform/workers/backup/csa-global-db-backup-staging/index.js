const DATABASES = {
  global: { binding: "DB_GLOBAL", database_id: "6a32dda3-b8c5-413c-9f51-58f0a9fa0712" },
  superadmin: { binding: "DB_SUPERADMIN", database_id: "c2bb3fb5-db22-4ed5-9283-161df57ebac2" },
  superadmin_legacy: { binding: "DB_SUPERADMIN_LEGACY", database_id: "99bc81fc-e97e-488b-a380-eb0237ff8ffc" },
  global_legacy: { binding: "DB_GLOBAL_LEGACY", database_id: "470a81b8-3d36-4e2d-942c-5cbb2746a473" },
  video_legacy: { binding: "DB_VIDEO", database_id: "b611b8ff-8f9f-43b2-95c8-a767a14987d6" },
  global_video_legacy: { binding: "DB_GLOBAL_VIDEO_LEGACY", database_id: "2d3f97a0-fa32-46ef-9913-972a59a410e4" },
  editor_superadmin: { binding: "DB_EDITOR_SUPERADMIN", database_id: "1fc2979f-52e2-420e-80f5-b70a51f6ac6c" },
  video_workflow: { binding: "DB_VIDEO_WORKFLOW", database_id: "69f070a4-b71f-4448-973f-31993715b781" },
  rush: { binding: "DB_RUSH", database_id: "198a0604-af4d-4671-8053-5df245ea754c" },
  rush_isolated: { binding: "DB_RUSH_ISOLATED", database_id: "99c797a2-d822-437f-a4d7-31d658f3862f" },
};

// One D1 database per invocation keeps each scheduled run small and recoverable.
// All ten entries below are daily UTC schedules.
const CRON_TO_DATABASE = {
  "2 2 * * *": "global",
  "7 2 * * *": "superadmin",
  "12 2 * * *": "superadmin_legacy",
  "17 2 * * *": "global_legacy",
  "22 2 * * *": "video_legacy",
  "27 2 * * *": "global_video_legacy",
  "32 2 * * *": "editor_superadmin",
  "37 2 * * *": "video_workflow",
  "42 2 * * *": "rush",
  "47 2 * * *": "rush_isolated",
};

const PAGE_SIZE = 1000;
const BATCH_SIZE = 40;
const RETENTION_DAYS = 30;

function quoteIdentifier(value) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

function encodeBinary(value) {
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { $type: "base64", data: btoa(binary) };
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return [key, encodeBinary(value)];
    if (typeof value === "bigint") return [key, value.toString()];
    return [key, value];
  }));
}

async function exportDatabase(db, databaseName, databaseId, generatedAt, bucket) {
  const schemaResult = await db.prepare(
    "SELECT type, name, sql FROM sqlite_master " +
    "WHERE type IN ('table','view','index','trigger') " +
    "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' " +
    "ORDER BY type, name"
  ).all();
  const schema = schemaResult.results || [];
  const tableDefinitions = schema.filter(item => item.type === "table");
  const views = schema.filter(item => item.type === "view").map(item => ({
    name: item.name,
    sql: item.sql,
  }));
  const triggers = schema.filter(item => item.type === "trigger").map(item => ({
    name: item.name,
    sql: item.sql,
  }));
  const quickCheckResult = await db.prepare("PRAGMA quick_check").all();
  const quickCheckRows = quickCheckResult.results || [];
  const quickCheck = quickCheckRows.length === 1 ? String(quickCheckRows[0].quick_check || "") : "";
  if (quickCheck !== "ok") throw new Error("backup_quick_check_failed");
  const fkCheck = await db.prepare("PRAGMA foreign_key_check").all();
  const foreignKeyViolations = (fkCheck.results || []).length;
  if (foreignKeyViolations !== 0) throw new Error("backup_foreign_key_check_failed");
  const tables = [];

  for (let start = 0; start < tableDefinitions.length; start += BATCH_SIZE) {
    const chunk = tableDefinitions.slice(start, start + BATCH_SIZE);
    const firstPages = await db.batch(chunk.map(definition => db.prepare(
      "SELECT * FROM " + quoteIdentifier(definition.name) + " LIMIT ?"
    ).bind(PAGE_SIZE)));

    for (let i = 0; i < chunk.length; i++) {
      const definition = chunk[i];
      const rows = (firstPages[i]?.results || []).map(normalizeRow);
      let offset = PAGE_SIZE;
      while ((firstPages[i]?.results || []).length === PAGE_SIZE) {
        const page = await db.prepare(
          "SELECT * FROM " + quoteIdentifier(definition.name) + " LIMIT ? OFFSET ?"
        ).bind(PAGE_SIZE, offset).all();
        const batch = page.results || [];
        rows.push(...batch.map(normalizeRow));
        offset += PAGE_SIZE;
        if (batch.length < PAGE_SIZE) break;
      }
      tables.push({
        name: definition.name,
        sql: definition.sql,
        row_count: rows.length,
        rows,
      });
    }
  }

  const payload = {
    format: "csa-d1-logical-backup-v1",
    environment: "staging",
    database: databaseName,
    database_id: databaseId,
    generated_at: generatedAt,
    tables,
    views,
    triggers,
    integrity: { quick_check: quickCheck, foreign_key_violations: foreignKeyViolations },
    indexes: schema.filter(item => item.type === "index").map(item => ({
      name: item.name,
      sql: item.sql,
    })),
  };
  const json = JSON.stringify(payload);
  const compressedStream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = await new Response(compressedStream).arrayBuffer();
  const stamp = generatedAt.replaceAll(":", "-").replaceAll(".", "-");
  const date = generatedAt.slice(0, 10);
  const key = `daily/${date}/${stamp}/${databaseName}.json.gz`;

  await bucket.put(key, compressed, {
    httpMetadata: { contentType: "application/gzip" },
    customMetadata: {
      environment: "staging",
      database: databaseName,
      databaseId,
      generatedAt,
      format: "csa-d1-logical-backup-v1",
      tableCount: String(tables.length),
      rowCount: String(tables.reduce((sum, table) => sum + table.row_count, 0)),
      quickCheck,
      foreignKeyViolations: String(foreignKeyViolations),
    },
  });

  const result = {
    database: databaseName,
    database_id: databaseId,
    key,
    table_count: tables.length,
    row_count: tables.reduce((sum, table) => sum + table.row_count, 0),
    trigger_count: triggers.length,
    quick_check: quickCheck,
    foreign_key_violations: foreignKeyViolations,
    compressed_bytes: compressed.byteLength,
  };
  const verification = await verifyStoredBackup(bucket, key, {
    database: databaseName,
    database_id: result.database_id,
    generated_at: generatedAt,
    table_count: result.table_count,
    row_count: result.row_count,
    trigger_count: result.trigger_count,
    compressed_bytes: result.compressed_bytes,
  });
  await bucket.put(
    `daily/${date}/${stamp}/${databaseName}.manifest.json`,
    JSON.stringify({ format: "csa-d1-logical-backup-manifest-v1", generated_at: generatedAt, verification_status: verification.status, ...result }, null, 2),
    { httpMetadata: { contentType: "application/json" } }
  );
  await bucket.put(
    `daily/${date}/${stamp}/${databaseName}.verification.json`,
    JSON.stringify(verification, null, 2),
    {
      httpMetadata: { contentType: "application/json" },
      customMetadata: {
        environment: "staging",
        database: databaseName,
        status: verification.status,
        quickCheck: verification.quick_check,
        foreignKeyViolations: String(verification.foreign_key_violations),
      },
    }
  );
  return { ...result, verification_status: verification.status };
}

async function verifyStoredBackup(bucket, key, expected) {
  const stored = await bucket.get(key);
  if (!stored) throw new Error("backup_object_missing_after_put");
  const decompressed = stored.body.pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(decompressed).text();
  const payload = JSON.parse(text);
  if (
    payload.format !== "csa-d1-logical-backup-v1" ||
    payload.environment !== "staging" ||
    payload.database !== expected.database ||
    payload.database_id !== expected.database_id ||
    payload.generated_at !== expected.generated_at
  ) throw new Error("backup_object_identity_verification_failed");

  const tables = Array.isArray(payload.tables) ? payload.tables : [];
  const rowCount = tables.reduce((sum, table) => {
    if (!Array.isArray(table.rows) || Number(table.row_count) !== table.rows.length) {
      throw new Error("backup_object_table_row_count_mismatch");
    }
    return sum + table.rows.length;
  }, 0);
  const triggerCount = Array.isArray(payload.triggers) ? payload.triggers.length : -1;
  const integrity = payload.integrity || {};
  if (
    tables.length !== expected.table_count ||
    rowCount !== expected.row_count ||
    triggerCount !== expected.trigger_count ||
    integrity.quick_check !== "ok" ||
    Number(integrity.foreign_key_violations) !== 0
  ) throw new Error("backup_object_content_verification_failed");

  return {
    status: "verified",
    database: expected.database,
    database_id: expected.database_id,
    object_key: key,
    verified_at: new Date().toISOString(),
    table_count: tables.length,
    row_count: rowCount,
    trigger_count: triggerCount,
    quick_check: integrity.quick_check,
    foreign_key_violations: Number(integrity.foreign_key_violations),
    compressed_bytes: expected.compressed_bytes,
  };
}

async function pruneOldBackups(bucket) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let cursor;
  let deleted = 0;
  do {
    const page = await bucket.list({
      prefix: "daily/",
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    for (const object of page.objects || []) {
      if (object.uploaded && object.uploaded.getTime() < cutoff) {
        await bucket.delete(object.key);
        deleted += 1;
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

async function runBackupForDatabase(env, databaseName, cron) {
  const databaseConfig = DATABASES[databaseName];
  if (!databaseConfig) throw new Error("Unknown backup database: " + databaseName);
  const bindingName = databaseConfig.binding;
  const db = env[bindingName];
  if (!db) throw new Error("Missing D1 binding: " + bindingName);
  if (databaseName === "global") {
    const isolatedSchema = await db.prepare("SELECT 1 FROM sqlite_master WHERE type='view' AND name='v_tender_country_scope'").first();
    if (!isolatedSchema) throw new Error("isolated_global_d1_binding_mismatch");
  }
  if (databaseName === "global_legacy") {
    const mainStackSchema = await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='country_legal_evidence'").first();
    const isolatedSchema = await db.prepare("SELECT 1 FROM sqlite_master WHERE type='view' AND name='v_tender_country_scope'").first();
    if (!mainStackSchema || isolatedSchema) throw new Error("main_global_d1_binding_mismatch");
  }
  const generatedAt = new Date().toISOString();
  console.log(JSON.stringify({ event: "csa_d1_backup_started", database: databaseName, database_id: databaseConfig.database_id, cron, generated_at: generatedAt }));
  const result = await exportDatabase(db, databaseName, databaseConfig.database_id, generatedAt, env.BACKUPS);
  const deleted = databaseName === "global" ? await pruneOldBackups(env.BACKUPS) : 0;
  console.log(JSON.stringify({
    event: "csa_d1_backup_complete",
    generated_at: generatedAt,
    database: databaseName,
    database_id: result.database_id,
    table_count: result.table_count,
    row_count: result.row_count,
    trigger_count: result.trigger_count,
    quick_check: result.quick_check,
    foreign_key_violations: result.foreign_key_violations,
    compressed_bytes: result.compressed_bytes,
    verification_status: result.verification_status,
    deleted_expired_objects: deleted,
  }));
}

export default {
  async scheduled(event, env, ctx) {
    const databaseName = CRON_TO_DATABASE[event.cron];
    if (!databaseName) {
      console.error("csa_d1_backup_unknown_cron", event.cron);
      return;
    }
    ctx.waitUntil(runBackupForDatabase(env, databaseName, event.cron).catch(error => {
      console.error("csa_d1_backup_failed", databaseName, error?.message || String(error));
    }));
  },

  async fetch() {
    return new Response("Not Found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  },
};