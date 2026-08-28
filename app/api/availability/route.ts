import { NextRequest, NextResponse } from "next/server";
import { pg, chInsertEvent } from "@/lib/db";

// DECLARE — a person states an hour they have or an hour that's hard.
// Postgres holds current truth; ClickHouse gets the history event.
export async function POST(req: NextRequest) {
  const b = await req.json();
  const { user_id, display_name, org_id, weekday, start_min, end_min, kind, radius_m } = b;

  let uid = user_id;
  if (!uid && display_name) {
    // public /join intake: real signup, same code path as the seeded population
    const u = await pg.query(
      `INSERT INTO users (display_name, org_id, zip, seeded)
       VALUES ($1, $2, $3, false) RETURNING id`,
      [display_name, org_id, b.zip ?? "94115"],
    );
    uid = Number(u.rows[0].id);
    await pg.query("INSERT INTO consent (user_id, share_level) VALUES ($1, 'org')", [uid]);
  }

  await pg.query(
    `INSERT INTO availability (user_id, weekday, start_min, end_min, kind, radius_m)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uid, weekday, start_min, end_min, kind, radius_m ?? 2000],
  );
  await chInsertEvent({
    event_type: "declared",
    user_id: uid,
    org_id,
    weekday,
    start_min,
    duration_min: end_min - start_min,
    kind,
  });
  return NextResponse.json({ user_id: uid, ok: true });
}
