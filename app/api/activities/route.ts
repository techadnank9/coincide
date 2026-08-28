import { NextRequest, NextResponse } from "next/server";
import { pg, chInsertEvent } from "@/lib/db";

// The marketplace: upcoming activities in an org, with hosts and headcounts.
export async function GET(req: NextRequest) {
  const orgId = Number(req.nextUrl.searchParams.get("org_id") ?? 1);
  const res = await pg.query(
    `SELECT a.id, a.title, a.starts_at, a.duration_min, a.place_label, a.capacity,
            a.host_id, u.display_name AS host_name,
            count(m.user_id)::int AS joined,
            coalesce(array_agg(mu.display_name) FILTER (WHERE mu.display_name IS NOT NULL), '{}') AS members
     FROM activities a
     JOIN users u ON u.id = a.host_id
     LEFT JOIN activity_members m ON m.activity_id = a.id
     LEFT JOIN users mu ON mu.id = m.user_id
     WHERE a.org_id = $1 AND a.starts_at > now() - interval '2 hours'
     GROUP BY a.id, u.display_name
     ORDER BY a.starts_at
     LIMIT 50`,
    [orgId],
  );
  return NextResponse.json({
    activities: res.rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      starts_at: r.starts_at,
      duration_min: Number(r.duration_min),
      place_label: r.place_label,
      capacity: Number(r.capacity),
      host_id: Number(r.host_id),
      host_name: r.host_name,
      joined: r.joined,
      members: r.members,
    })),
  });
}

// Post an activity: a real hour with a time and a place, open to the org.
export async function POST(req: NextRequest) {
  const b = await req.json();
  const { host_id, org_id, title, starts_at, duration_min, place_label, capacity } = b;
  if (!host_id || !title?.trim() || !starts_at || !place_label?.trim()) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const res = await pg.query(
    `INSERT INTO activities (host_id, org_id, title, starts_at, duration_min, place_label, capacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [host_id, org_id ?? 1, title.trim(), starts_at, duration_min ?? 60, place_label.trim(), capacity ?? 6],
  );
  const start = new Date(starts_at);
  await chInsertEvent({
    event_type: "declared",
    user_id: host_id,
    org_id: org_id ?? 1,
    weekday: start.getDay(),
    start_min: start.getHours() * 60 + start.getMinutes(),
    duration_min: duration_min ?? 60,
    kind: "surplus",
    group_size: capacity ?? 6,
  });
  return NextResponse.json({ activity_id: Number(res.rows[0].id) });
}
