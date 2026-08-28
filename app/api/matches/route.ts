import { NextRequest, NextResponse } from "next/server";
import { pg } from "@/lib/db";

// Matches touching one user — for the persona view.
export async function GET(req: NextRequest) {
  const userId = Number(req.nextUrl.searchParams.get("user_id"));
  const res = await pg.query(
    `SELECT m.id, m.user_a, m.user_b, m.slot_start, m.slot_end, m.place_label,
            m.state, m.created_at,
            ua.display_name AS name_a, ub.display_name AS name_b
     FROM matches m
     JOIN users ua ON ua.id = m.user_a
     JOIN users ub ON ub.id = m.user_b
     WHERE m.user_a = $1 OR m.user_b = $1
     ORDER BY m.created_at DESC
     LIMIT 20`,
    [userId],
  );
  return NextResponse.json({
    matches: res.rows.map((r) => ({
      id: Number(r.id),
      user_a: Number(r.user_a),
      user_b: Number(r.user_b),
      name_a: r.name_a,
      name_b: r.name_b,
      slot_start: r.slot_start,
      slot_end: r.slot_end,
      place_label: r.place_label,
      state: r.state,
    })),
  });
}
