import { NextRequest, NextResponse } from "next/server";
import { pg } from "@/lib/db";

// One event, fully: host, headcount, and who's going.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [a, members] = await Promise.all([
    pg.query(
      `SELECT a.*, u.display_name AS host_name, o.name AS org_name
       FROM activities a
       JOIN users u ON u.id = a.host_id
       JOIN orgs o ON o.id = a.org_id
       WHERE a.id = $1`,
      [Number(id)],
    ),
    pg.query(
      `SELECT u.id, u.display_name FROM activity_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.activity_id = $1 ORDER BY m.joined_at`,
      [Number(id)],
    ),
  ]);
  if (!a.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  const r = a.rows[0];
  return NextResponse.json({
    id: Number(r.id),
    title: r.title,
    starts_at: r.starts_at,
    duration_min: Number(r.duration_min),
    place_label: r.place_label,
    capacity: Number(r.capacity),
    org: r.org_name,
    host: { id: Number(r.host_id), name: r.host_name },
    members: members.rows.map((m) => ({ id: Number(m.id), name: m.display_name })),
  });
}
