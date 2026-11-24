const DATABASES = [
  ["global", "DB_GLOBAL"],
  ["superadmin", "DB_SUPERADMIN"],
  ["superadmin_legacy", "DB_SUPERADMIN_LEGACY"],
  ["global_legacy", "DB_GLOBAL_LEGACY"],
  ["video_legacy", "DB_VIDEO"],
];

const PAGE_SIZE = 500;
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
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      return [key, encodeBinary(value)];
    }
    if (typeof value === "bigint") return [key, value.toString()];
    return [key, value];
  }));
}

async function exportDatabase(db, databaseName, generatedAt, bucket) {
  const schemaResult = await db.prepare(
    "SELECT type, name, sql FROM sqlite_master " +
    "WHERE type IN ('table','view','index') " +
    "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' " +
    "ORDER BY type, name"
  ).all();

  const schema = schemaResult.results || [];
  const tableDefinitions = schema.filter(item => item.type === "table");
  const views = schema.filter(item => item.type === "view").map(item => ({
    name: item.name,
    sql: item.sql,
  }));
  const tables = [];

  for (const definition of tableDefinitions) {
    const rows = [];
    let offset = 0;
    while (true) {
      const page = await db.prepare(
        "SELECT * FROM " + quoteIdentifier(definition.name) + " LIMIT ? OFFSET ?"
      ).bind(PAGE_SIZE, offset).all();
      const batch = page.results || [];
      rows.push(...batch.map(normalizeRow));
      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    tables.push({
      name: definition.name,
      sql: definition.sql,
      row_count: rows.length,
      rows,
    });
  }

  const payload = {
    format: "csa-d1-logical-backup-v1",
    environment: "staging",
    database: databaseName,
    generated_at: generatedAt,
    tables,
    views,
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
      generatedAt,
      format: "csa-d1-logical-backup-v1",
      tableCount: String(tables.length),
      rowCount: String(tables.reduce((sum, table) => sum + table.row_count, 0)),
    },
  });

  return {
    database: databaseName,
    key,
    table_count: tables.length,
    row_count: tables.reduce((sum, table) => sum + table.row_count, 0),
    compressed_bytes: compressed.byteLength,
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

async function runBackup(env) {
  const generatedAt = new Date().toISOString();
  const results = [];

  for (const [databaseName, bindingName] of DATABASES) {
    const db = env[bindingName];
    if (!db) throw new Error("Missing D1 binding: " + bindingName);
    results.push(await exportDatabase(db, databaseName, generatedAt, env.BACKUPS));
  }

  const manifest = {
    format: "csa-d1-logical-backup-manifest-v1",
    environment: "staging",
    generated_at: generatedAt,
    retention_days: RETENTION_DAYS,
    backups: results,
  };
  const stamp = generatedAt.replaceAll(":", "-").replaceAll(".", "-");
  await env.BACKUPS.put(
    `daily/${generatedAt.slice(0, 10)}/${stamp}/manifest.json`,
    JSON.stringify(manifest, null, 2),
    { httpMetadata: { contentType: "application/json" } }
  );

  const deleted = await pruneOldBackups(env.BACKUPS);
  console.log(JSON.stringify({
    event: "csa_staging_d1_backup_complete",
    generated_at: generatedAt,
    databases: results.length,
    rows: results.reduce((sum, item) => sum + item.row_count, 0),
    deleted_expired_objects: deleted,
  }));
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runBackup(env).catch(error => {
      console.error("csa_staging_d1_backup_failed", error?.message || String(error));
    }));
  },

  async fetch() {
    return new Response("Not Found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  },
};
