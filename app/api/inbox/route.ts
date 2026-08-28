import { NextRequest, NextResponse } from "next/server";
import { pg } from "@/lib/db";

// Latest message per counterpart, newest thread first.
export async function GET(req: NextRequest) {
  const userId = Number(req.nextUrl.searchParams.get("user_id"));
  const res = await pg.query(
    `SELECT DISTINCT ON (other) *
     FROM (
       SELECT m.*,
              CASE WHEN m.from_id = $1 THEN m.to_id ELSE m.from_id END AS other
       FROM messages m
       WHERE m.from_id = $1 OR m.to_id = $1
     ) t
     ORDER BY other, created_at DESC`,
    [userId],
  );
  const ids = res.rows.map((r) => Number(r.other));
  const names = ids.length
    ? await pg.query("SELECT id, display_name FROM users WHERE id = ANY($1)", [ids])
    : { rows: [] };
  const byId = new Map(names.rows.map((n) => [Number(n.id), n.display_name]));
  return NextResponse.json({
    threads: res.rows
      .sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
      .map((r) => ({
        other_id: Number(r.other),
        other_name: byId.get(Number(r.other)) ?? `#${r.other}`,
        last: r.body,
        at: r.created_at,
        mine: Number(r.from_id) === userId,
      })),
  });
}
