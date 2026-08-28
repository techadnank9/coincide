import { NextRequest, NextResponse } from "next/server";
import { chQuery, pg } from "@/lib/db";

// SURFACE — deficit-hour trajectory per user, month over month, ranked by
// slope, filtered to those unmatched in 3 weeks. Attendance is a level; the
// trajectory is the signal.
export async function GET(req: NextRequest) {
  const orgId = Number(req.nextUrl.searchParams.get("org_id") ?? 1);
  const { rows, stats } = await chQuery<{
    user_id: string;
    deficit_slope: number;
    total_deficit: string;
    total_attended: string;
    monthly: [string, string][];
    last_matched: string;
  }>(
    `WITH monthly AS (
       SELECT
         user_id,
         toStartOfMonth(event_time) AS month,
         countIf(event_type = 'declared' AND kind = 'deficit') AS deficit_hours,
         countIf(event_type = 'attended') AS attended
       FROM surplus.hour_events
       WHERE org_id = {org_id: UInt32}
         AND event_time > now() - INTERVAL 8 MONTH
       GROUP BY user_id, month
     ),
     slopes AS (
       SELECT
         user_id,
         covarPop(toUnixTimestamp(month) / 2592000, deficit_hours)
           / greatest(varPop(toUnixTimestamp(month) / 2592000), 0.001) AS slope,
         sum(deficit_hours) AS total_deficit,
         sum(attended)      AS total_attended,
         groupArray((toString(month), toString(deficit_hours))) AS monthly,
         count() AS months_active
       FROM monthly
       GROUP BY user_id
       HAVING months_active >= 4 AND total_deficit > 10
     ),
     last_match AS (
       SELECT user_id, max(event_time) AS last_matched
       FROM surplus.hour_events
       WHERE org_id = {org_id: UInt32}
         AND event_type IN ('proposed', 'accepted')
       GROUP BY user_id
     )
     SELECT
       s.user_id,
       round(s.slope, 2) AS deficit_slope,
       s.total_deficit,
       s.total_attended,
       s.monthly,
       toString(lm.last_matched) AS last_matched
     FROM slopes s
     LEFT JOIN last_match lm ON lm.user_id = s.user_id
     WHERE lm.last_matched < now() - INTERVAL 3 WEEK
        OR lm.last_matched = toDateTime64(0, 3)
     ORDER BY s.slope DESC
     LIMIT 15`,
    { org_id: orgId },
  );

  const ids = rows.map((r) => Number(r.user_id));
  const names = ids.length
    ? await pg.query(
        "SELECT id, display_name, zip, seeded FROM users WHERE id = ANY($1)",
        [ids],
      )
    : { rows: [] };
  const byId = new Map(names.rows.map((n) => [Number(n.id), n]));

  return NextResponse.json({
    people: rows.map((r) => {
      const u = byId.get(Number(r.user_id));
      return {
        user_id: Number(r.user_id),
        name: u?.display_name ?? `#${r.user_id}`,
        zip: u?.zip,
        seeded: u?.seeded ?? true,
        deficit_slope: r.deficit_slope,
        total_deficit: Number(r.total_deficit),
        total_attended: Number(r.total_attended),
        monthly: r.monthly
          .map(([m, d]) => ({ month: m, deficit: Number(d) }))
          .sort((a, b) => a.month.localeCompare(b.month)),
        last_matched: r.last_matched.startsWith("1970") ? null : r.last_matched,
      };
    }),
    ...stats,
  });
}
