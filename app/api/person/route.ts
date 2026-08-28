import { NextRequest, NextResponse } from "next/server";
import { pg } from "@/lib/db";

// One person's current truth: identity + declared windows, from Postgres.
export async function GET(req: NextRequest) {
  const userId = Number(req.nextUrl.searchParams.get("user_id"));
  const [u, av] = await Promise.all([
    pg.query("SELECT id, display_name, org_id, zip, seeded FROM users WHERE id = $1", [userId]),
    pg.query(
      `SELECT weekday, start_min, end_min, kind, radius_m
       FROM availability WHERE user_id = $1
       ORDER BY kind DESC, weekday, start_min`,
      [userId],
    ),
  ]);
  if (!u.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: Number(u.rows[0].id),
    name: u.rows[0].display_name,
    org_id: Number(u.rows[0].org_id),
    zip: u.rows[0].zip,
    seeded: u.rows[0].seeded,
    windows: av.rows.map((w) => ({
      weekday: Number(w.weekday),
      start_min: Number(w.start_min),
      end_min: Number(w.end_min),
      kind: w.kind,
      radius_m: Number(w.radius_m),
    })),
  });
}
