const DATABASES = {
  global: "DB_GLOBAL",
  superadmin: "DB_SUPERADMIN",
  superadmin_legacy: "DB_SUPERADMIN_LEGACY",
  global_legacy: "DB_GLOBAL_LEGACY",
  video_legacy: "DB_VIDEO",
};

// One D1 database per invocation keeps each scheduled run small and recoverable.
// The */5 entry is temporary first-run verification; production schedule is daily below.
const CRON_TO_DATABASE = {
  "*/5 * * * *": "superadmin_legacy",
  "0 2 * * *": "global",
  "5 2 * * *": "superadmin",
  "10 2 * * *": "superadmin_legacy",
  "15 2 * * *": "global_legacy",
  "20 2 * * *": "video_legacy",
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

  const result = {
    database: databaseName,
    key,
    table_count: tables.length,
    row_count: tables.reduce((sum, table) => sum + table.row_count, 0),
    compressed_bytes: compressed.byteLength,
  };
  await bucket.put(
    `daily/${date}/${stamp}/${databaseName}.manifest.json`,
    JSON.stringify({ format: "csa-d1-logical-backup-manifest-v1", generated_at: generatedAt, ...result }, null, 2),
    { httpMetadata: { contentType: "application/json" } }
  );
  return result;
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
  const bindingName = DATABASES[databaseName];
  if (!bindingName) throw new Error("Unknown backup database: " + databaseName);
  const db = env[bindingName];
  if (!db) throw new Error("Missing D1 binding: " + bindingName);
  const generatedAt = new Date().toISOString();
  console.log(JSON.stringify({ event: "csa_d1_backup_started", database: databaseName, cron, generated_at: generatedAt }));
  const result = await exportDatabase(db, databaseName, generatedAt, env.BACKUPS);
  const deleted = databaseName === "global" ? await pruneOldBackups(env.BACKUPS) : 0;
  console.log(JSON.stringify({
    event: "csa_d1_backup_complete",
    generated_at: generatedAt,
    database: databaseName,
    table_count: result.table_count,
    row_count: result.row_count,
    compressed_bytes: result.compressed_bytes,
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
