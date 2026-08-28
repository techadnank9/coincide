import { NextRequest, NextResponse } from "next/server";
import { pg } from "@/lib/db";

// Everything the map draws: people with their listed hours, and upcoming
// activities. People are capped; canvas markers keep thousands smooth.
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 2500), 6000);
  const [people, acts] = await Promise.all([
    pg.query(
      `SELECT u.id, u.display_name, u.lat, u.lng, u.org_id, o.name AS org_name,
              coalesce(json_agg(json_build_object(
                'weekday', a.weekday, 'start_min', a.start_min,
                'end_min', a.end_min, 'kind', a.kind
              ) ORDER BY a.weekday, a.start_min) FILTER (WHERE a.id IS NOT NULL), '[]') AS windows
       FROM users u
       JOIN orgs o ON o.id = u.org_id
       LEFT JOIN availability a ON a.user_id = u.id
       WHERE u.lat IS NOT NULL
       GROUP BY u.id, o.name
       ORDER BY u.org_id = 1 DESC, u.id > 30000 DESC, u.id
       LIMIT $1`,
      [limit],
    ),
    pg.query(
      `SELECT a.id, a.title, a.starts_at, a.place_label, a.capacity, a.lat, a.lng,
              u.display_name AS host_name, count(m.user_id)::int AS joined
       FROM activities a
       JOIN users u ON u.id = a.host_id
       LEFT JOIN activity_members m ON m.activity_id = a.id
       WHERE a.lat IS NOT NULL AND a.starts_at > now() - interval '2 hours'
       GROUP BY a.id, u.display_name
       ORDER BY a.starts_at`,
    ),
  ]);
  return NextResponse.json({
    people: people.rows.map((r) => ({
      id: Number(r.id),
      name: r.display_name,
      lat: r.lat,
      lng: r.lng,
      org: r.org_name,
      windows: r.windows,
    })),
    activities: acts.rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      starts_at: r.starts_at,
      place_label: r.place_label,
      capacity: Number(r.capacity),
      lat: r.lat,
      lng: r.lng,
      host_name: r.host_name,
      joined: r.joined,
    })),
  });
}
