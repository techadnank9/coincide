import { NextRequest, NextResponse } from "next/server";
import { pg, chInsertEvent } from "@/lib/db";

// PROPOSE — Postgres transaction: insert match, lock both users.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { user_a, user_b, weekday, start_min, duration_min, place_label, org_id } = body;

  // next occurrence of that weekday/time
  const now = new Date();
  const slot = new Date(now);
  slot.setDate(now.getDate() + ((weekday - now.getDay() + 7) % 7 || 7));
  slot.setHours(Math.floor(start_min / 60), start_min % 60, 0, 0);
  const slotEnd = new Date(slot.getTime() + duration_min * 60000);

  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT id FROM users WHERE id = ANY($1) ORDER BY id FOR UPDATE",
      [[user_a, user_b]],
    );
    const dup = await client.query(
      `SELECT id FROM matches
       WHERE user_a = $1 AND user_b = $2 AND state = 'proposed' AND slot_start = $3`,
      [user_a, user_b, slot],
    );
    if (dup.rows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "already proposed" }, { status: 409 });
    }
    const res = await client.query(
      `INSERT INTO matches (user_a, user_b, slot_start, slot_end, place_label, state)
       VALUES ($1, $2, $3, $4, $5, 'proposed') RETURNING id`,
      [user_a, user_b, slot, slotEnd, place_label ?? null],
    );
    await client.query("COMMIT");
    const matchId = Number(res.rows[0].id);
    await chInsertEvent({
      event_type: "proposed",
      user_id: user_a,
      counterpart_id: user_b,
      org_id,
      weekday,
      start_min,
      duration_min,
      match_id: matchId,
    });
    return NextResponse.json({ match_id: matchId, state: "proposed", slot_start: slot });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
