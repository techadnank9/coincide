import { NextRequest, NextResponse } from "next/server";
import { pg } from "@/lib/db";

// One thread between two people.
export async function GET(req: NextRequest) {
  const a = Number(req.nextUrl.searchParams.get("a"));
  const b = Number(req.nextUrl.searchParams.get("b"));
  const res = await pg.query(
    `SELECT id, from_id, to_id, body, created_at FROM messages
     WHERE least(from_id, to_id) = least($1::bigint, $2::bigint)
       AND greatest(from_id, to_id) = greatest($1::bigint, $2::bigint)
     ORDER BY created_at DESC LIMIT 80`,
    [a, b],
  );
  return NextResponse.json({
    messages: res.rows.reverse().map((m) => ({
      id: Number(m.id),
      from_id: Number(m.from_id),
      to_id: Number(m.to_id),
      body: m.body,
      created_at: m.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { from_id, to_id, body } = await req.json();
  if (!from_id || !to_id || !body?.trim() || body.length > 2000) {
    return NextResponse.json({ error: "missing or too-long message" }, { status: 400 });
  }
  const res = await pg.query(
    "INSERT INTO messages (from_id, to_id, body) VALUES ($1, $2, $3) RETURNING id",
    [from_id, to_id, body.trim()],
  );
  return NextResponse.json({ id: Number(res.rows[0].id) });
}
