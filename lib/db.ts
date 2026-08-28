import { Pool } from "pg";
import { createClient } from "@clickhouse/client";

// POSTGRES_URL (hosted, e.g. ClickHouse Cloud Postgres or Neon) wins over the
// local default. Hosted providers require TLS.
export const pg = process.env.POSTGRES_URL
  ? new Pool({
      connectionString: process.env.POSTGRES_URL,
      max: 8,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({ database: "surplus", max: 8 });

// CLICKHOUSE_TARGET=cloud in .env.local flips the app onto ClickHouse Cloud;
// local remains the default for the demo.
const cloud = process.env.CLICKHOUSE_TARGET === "cloud";
export const ch = createClient(
  cloud
    ? {
        url: process.env.CLICKHOUSE_CLOUD_URL,
        username: process.env.CLICKHOUSE_CLOUD_USER,
        password: process.env.CLICKHOUSE_CLOUD_PASSWORD,
      }
    : { url: "http://localhost:8123" },
);

export interface ChStats {
  rows_read: number;
  elapsed_ms: number;
}

// Run a ClickHouse query, returning rows plus the scan statistics the judges
// care about. Statistics come from ClickHouse itself, not our wall clock.
export async function chQuery<T>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<{ rows: T[]; stats: ChStats }> {
  const rs = await ch.query({
    query,
    query_params: params,
    format: "JSON",
  });
  const body = (await rs.json()) as {
    data: T[];
    statistics: { elapsed: number; rows_read: number };
  };
  return {
    rows: body.data,
    stats: {
      rows_read: body.statistics.rows_read,
      elapsed_ms: Math.round(body.statistics.elapsed * 10000) / 10,
    },
  };
}

export async function chInsertEvent(row: Record<string, unknown>) {
  await ch.insert({
    table: "surplus.hour_events",
    values: [
      {
        event_time: Date.now(),
        counterpart_id: 0,
        distance_m: 0,
        group_size: 2,
        lead_time_min: 0,
        match_id: 0,
        duration_min: 60,
        kind: "",
        ...row,
      },
    ],
    format: "JSONEachRow",
  });
}
