// One-off: stream the local hour_events table (including post-seed demo
// fixups) to ClickHouse Cloud. Credentials come from .env.local.
// Raw JSONEachRow bytes are piped straight from the local HTTP interface
// into the cloud insert — no per-row decode.
import { createClient } from "@clickhouse/client";
import { readFileSync } from "fs";
import http from "http";
import type { Readable } from "stream";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const cloud = createClient({
  url: process.env.CLICKHOUSE_CLOUD_URL,
  username: process.env.CLICKHOUSE_CLOUD_USER,
  password: process.env.CLICKHOUSE_CLOUD_PASSWORD,
  request_timeout: 300_000,
  clickhouse_settings: {
    send_progress_in_http_headers: 1,
    http_headers_progress_interval_ms: "20000",
  },
});

function localStream(sql: string): Promise<Readable> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "localhost", port: 8123, method: "POST" },
      (res) => (res.statusCode === 200 ? resolve(res) : reject(new Error(`local HTTP ${res.statusCode}`))),
    );
    req.on("error", reject);
    req.end(sql);
  });
}

const CHUNKS = 10;

async function main() {
  await cloud.command({ query: "TRUNCATE TABLE surplus.hour_events" });
  const t0 = Date.now();
  for (let k = 0; k < CHUNKS; k++) {
    const stream = await localStream(
      `SELECT * FROM surplus.hour_events WHERE intHash32(user_id) % ${CHUNKS} = ${k} FORMAT TabSeparated`,
    );
    await cloud.insert({
      table: "surplus.hour_events",
      values: stream,
      format: "TabSeparated",
    });
    console.log(`chunk ${k + 1}/${CHUNKS} done (${Math.round((Date.now() - t0) / 1000)}s elapsed)`);
  }
  const check = await cloud.query({
    query: "SELECT count() c FROM surplus.hour_events",
    format: "JSON",
  });
  console.log("cloud count:", ((await check.json()) as any).data[0].c);
  await cloud.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
