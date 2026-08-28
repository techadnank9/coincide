import { NextRequest, NextResponse } from "next/server";
import { pg, chInsertEvent } from "@/lib/db";

// ACCEPT — two-sided state change. Both sides commit or neither does.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user_id } = await req.json();

  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    const m = await client.query(
      "SELECT * FROM matches WHERE id = $1 FOR UPDATE",
      [Number(id)],
    );
    if (!m.rows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "no such match" }, { status: 404 });
    }
    const match = m.rows[0];
    if (match.state !== "proposed") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `match is ${match.state}, not proposed` },
        { status: 409 },
      );
    }
    if (Number(match.user_b) !== Number(user_id)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "only the proposed counterpart can accept" },
        { status: 403 },
      );
    }
    // lock both people, in id order, then flip the shared state
    await client.query(
      "SELECT id FROM users WHERE id = ANY($1) ORDER BY id FOR UPDATE",
      [[Number(match.user_a), Number(match.user_b)]],
    );
    await client.query("UPDATE matches SET state = 'accepted' WHERE id = $1", [
      Number(id),
    ]);
    await client.query("COMMIT");

    const org = await pg.query("SELECT org_id FROM users WHERE id = $1", [
      Number(match.user_a),
    ]);
    const slot = new Date(match.slot_start);
    await chInsertEvent({
      event_type: "accepted",
      user_id: Number(match.user_b),
      counterpart_id: Number(match.user_a),
      org_id: Number(org.rows[0].org_id),
      weekday: slot.getDay(),
      start_min: slot.getHours() * 60 + slot.getMinutes(),
      match_id: Number(id),
    });
    return NextResponse.json({ match_id: Number(id), state: "accepted" });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
