import { NextResponse } from "next/server";
import { pg } from "@/lib/db";

// The cast on the map: everyone with a curated profile, plus coordinates.
export async function GET() {
  const res = await pg.query(
    `SELECT u.id, u.display_name, u.lat, u.lng, p.handle, p.bio, p.interests,
            o.name AS org
     FROM profiles p
     JOIN users u ON u.id = p.user_id
     JOIN orgs o ON o.id = u.org_id
     WHERE u.lat IS NOT NULL`,
  );
  return NextResponse.json({
    live: res.rows.map((r) => ({
      id: Number(r.id),
      name: r.display_name,
      handle: r.handle,
      bio: r.bio,
      interests: r.interests,
      org: r.org,
      lat: r.lat,
      lng: r.lng,
    })),
  });
}
