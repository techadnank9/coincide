import { NextRequest, NextResponse } from "next/server";
import { pg, chQuery } from "@/lib/db";

// Rich profile card for the map: identity from Postgres, history from
// ClickHouse (how often they actually show up, how long they've been around).
export async function GET(req: NextRequest) {
  const userId = Number(req.nextUrl.searchParams.get("user_id"));
  const [u, av, hist] = await Promise.all([
    pg.query(
      `SELECT u.id, u.display_name, u.created_at, o.name AS org
       FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = $1`,
      [userId],
    ),
    pg.query(
      `SELECT weekday, start_min, end_min, kind FROM availability
       WHERE user_id = $1 ORDER BY weekday, start_min LIMIT 5`,
      [userId],
    ),
    chQuery<{ attended: string; no_shows: string; events: string; first_seen: string }>(
      `SELECT countIf(event_type = 'attended') AS attended,
              countIf(event_type = 'no_show') AS no_shows,
              count() AS events,
              toString(min(event_time)) AS first_seen
       FROM surplus.hour_events WHERE user_id = {uid: UInt64}`,
      { uid: userId },
    ),
  ]);
  if (!u.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  const h = hist.rows[0];
  return NextResponse.json({
    id: userId,
    name: u.rows[0].display_name,
    org: u.rows[0].org,
    windows: av.rows.map((w) => ({
      weekday: Number(w.weekday),
      start_min: Number(w.start_min),
      end_min: Number(w.end_min),
      kind: w.kind,
    })),
    attended: Number(h?.attended ?? 0),
    no_shows: Number(h?.no_shows ?? 0),
    events: Number(h?.events ?? 0),
    first_seen: h?.first_seen ?? null,
    scan_ms: hist.stats.elapsed_ms,
  });
}
