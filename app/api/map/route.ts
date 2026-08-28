import { NextRequest, NextResponse } from "next/server";
import { chQuery } from "@/lib/db";

// MAP — freight map: surplus vs deficit density, org × weekday × 30-min band.
export async function GET(req: NextRequest) {
  const orgId = Number(req.nextUrl.searchParams.get("org_id") ?? 1);
  const { rows, stats } = await chQuery<{
    weekday: number;
    band: number;
    surplus: string;
    deficit: string;
  }>(
    `SELECT
       weekday,
       band,
       countIf(kind = 'surplus') AS surplus,
       countIf(kind = 'deficit') AS deficit
     FROM (
       SELECT
         weekday,
         kind,
         -- a declared window covers every 30-min band it spans, not just its start
         arrayJoin(range(
           toUInt16(intDiv(start_min, 30)),
           toUInt16(intDiv(start_min + greatest(duration_min, 30) + 29, 30))
         )) AS band
       FROM surplus.hour_events
       WHERE org_id = {org_id: UInt32} AND event_type = 'declared'
     )
     GROUP BY weekday, band
     ORDER BY weekday, band`,
    { org_id: orgId },
  );
  return NextResponse.json({
    cells: rows.map((r) => ({
      weekday: r.weekday,
      band: r.band,
      surplus: Number(r.surplus),
      deficit: Number(r.deficit),
    })),
    ...stats,
  });
}
