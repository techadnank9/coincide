import { NextRequest, NextResponse } from "next/server";
import { pg, chQuery } from "@/lib/db";

// Rich profile card for the map: identity from Postgres, history from
// ClickHouse (how often they actually show up, how long they've been around).
export async function GET(req: NextRequest) {
  const userId = Number(req.nextUrl.searchParams.get("user_id"));
  const [u, av, hist, upcoming] = await Promise.all([
    pg.query(
      `SELECT u.id, u.display_name, u.created_at, o.name AS org,
              p.handle, p.bio, p.interests
       FROM users u
       JOIN orgs o ON o.id = u.org_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
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
    pg.query(
      `SELECT a.id, a.title, a.starts_at, a.place_label, a.capacity,
              a.host_id = $1 AS hosting,
              count(m.user_id)::int AS joined
       FROM activities a
       LEFT JOIN activity_members m ON m.activity_id = a.id
       WHERE a.starts_at > now()
         AND (a.host_id = $1 OR EXISTS (
           SELECT 1 FROM activity_members x WHERE x.activity_id = a.id AND x.user_id = $1))
       GROUP BY a.id
       ORDER BY a.starts_at
       LIMIT 8`,
      [userId],
    ),
  ]);
  if (!u.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  const h = hist.rows[0];
  return NextResponse.json({
    id: userId,
    name: u.rows[0].display_name,
    org: u.rows[0].org,
    handle: u.rows[0].handle,
    bio: u.rows[0].bio,
    interests: u.rows[0].interests ?? [],
    upcoming: upcoming.rows.map((a) => ({
      id: Number(a.id),
      title: a.title,
      starts_at: a.starts_at,
      place_label: a.place_label,
      capacity: Number(a.capacity),
      joined: a.joined,
      hosting: a.hosting,
    })),
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
