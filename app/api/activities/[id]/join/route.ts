import { NextRequest, NextResponse } from "next/server";
import { pg, chInsertEvent } from "@/lib/db";

// Join an activity. Transactional: the capacity check and the membership
// insert commit together or not at all.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user_id } = await req.json();
  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    const a = await client.query("SELECT * FROM activities WHERE id = $1 FOR UPDATE", [
      Number(id),
    ]);
    if (!a.rows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "no such activity" }, { status: 404 });
    }
    const act = a.rows[0];
    if (Number(act.host_id) === Number(user_id)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "you're hosting this one" }, { status: 409 });
    }
    const count = await client.query(
      "SELECT count(*)::int AS c FROM activity_members WHERE activity_id = $1",
      [Number(id)],
    );
    if (count.rows[0].c >= Number(act.capacity)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "this one's full" }, { status: 409 });
    }
    const dup = await client.query(
      "SELECT 1 FROM activity_members WHERE activity_id = $1 AND user_id = $2",
      [Number(id), Number(user_id)],
    );
    if (dup.rows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "already joined" }, { status: 409 });
    }
    await client.query(
      "INSERT INTO activity_members (activity_id, user_id) VALUES ($1, $2)",
      [Number(id), Number(user_id)],
    );
    await client.query("COMMIT");

    const start = new Date(act.starts_at);
    await chInsertEvent({
      event_type: "accepted",
      user_id: Number(user_id),
      counterpart_id: Number(act.host_id),
      org_id: Number(act.org_id),
      weekday: start.getDay(),
      start_min: start.getHours() * 60 + start.getMinutes(),
      duration_min: Number(act.duration_min),
      group_size: Number(act.capacity),
      match_id: Number(id),
    });
    return NextResponse.json({ joined: true });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
