import { NextRequest, NextResponse } from "next/server";
import { pg } from "@/lib/db";

// Email signup, deliberately light: no passwords, no verification flow.
// An email that already exists just signs you back in.
export async function POST(req: NextRequest) {
  const { name, email, org_id } = await req.json();
  if (!name?.trim() || !email?.includes("@")) {
    return NextResponse.json({ error: "name and a valid email required" }, { status: 400 });
  }
  const existing = await pg.query("SELECT id, display_name FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  if (existing.rows.length) {
    return NextResponse.json({
      user_id: Number(existing.rows[0].id),
      name: existing.rows[0].display_name,
      returning: true,
    });
  }
  const res = await pg.query(
    `INSERT INTO users (display_name, org_id, zip, seeded, email)
     VALUES ($1, $2, '94115', false, $3) RETURNING id`,
    [name.trim(), org_id ?? 1, email.toLowerCase()],
  );
  const uid = Number(res.rows[0].id);
  await pg.query(
    "INSERT INTO consent (user_id, share_level) VALUES ($1, 'org') ON CONFLICT DO NOTHING",
    [uid],
  );
  return NextResponse.json({ user_id: uid, name: name.trim(), returning: false });
}
