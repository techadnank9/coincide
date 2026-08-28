import { NextRequest, NextResponse } from "next/server";
import { chQuery, pg } from "@/lib/db";

// ROUTE — the query that is the whole product.
// score = temporal_overlap × reliability × proximity_decay × shape_fulfillment
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const orgId = Number(p.get("org_id") ?? 1);
  const userId = Number(p.get("user_id"));
  const weekday = Number(p.get("weekday"));
  const startMin = Number(p.get("start_min"));
  const durationMin = Number(p.get("duration_min") ?? 120);
  const radiusM = Number(p.get("radius_m") ?? 2000);

  const { rows, stats } = await chQuery<{
    candidate_id: string;
    temporal_overlap: number;
    reliability: number;
    attended: string;
    no_shows: string;
    proximity_decay: number;
    shape_fulfillment: number;
    score: number;
  }>(
    `WITH cand AS (
       SELECT
         user_id,
         sum(greatest(0,
           least(start_min + duration_min, {start_min: UInt16} + {duration_min: UInt16})
           - greatest(start_min, {start_min: UInt16})
         )) / {duration_min: UInt16} AS raw_overlap
       FROM surplus.hour_events
       WHERE org_id = {org_id: UInt32}
         AND weekday = {weekday: UInt8}
         AND event_type = 'declared'
         AND kind = 'surplus'
         AND user_id != {user_id: UInt64}
         AND event_time > now() - INTERVAL 6 MONTH
       GROUP BY user_id
       HAVING raw_overlap > 0
     ),
     mob AS (
       SELECT user_id, avg(distance_m) AS avg_dist
       FROM surplus.hour_events
       WHERE org_id = {org_id: UInt32}
         AND event_type IN ('proposed', 'attended', 'no_show')
         AND distance_m > 0
       GROUP BY user_id
     ),
     rel AS (
       SELECT
         user_id,
         countIf(event_type = 'attended') AS attended,
         countIf(event_type = 'no_show') AS no_shows,
         (attended + 1) / (attended + no_shows + 2) AS reliability
       FROM surplus.hour_events
       WHERE org_id = {org_id: UInt32}
         AND event_type IN ('attended', 'no_show')
         AND event_time > now() - INTERVAL 6 MONTH
       GROUP BY user_id
     ),
     shape AS (
       SELECT
         intDiv(distance_m, 1000) AS dist_bucket,
         (countIf(event_type = 'attended') + 1)
           / (countIf(event_type IN ('attended', 'no_show')) + 2) AS fulfillment
       FROM surplus.hour_events
       WHERE event_type IN ('attended', 'no_show') AND group_size = 2
       GROUP BY dist_bucket
     )
     SELECT
       cand.user_id AS candidate_id,
       round(least(cand.raw_overlap / 26, 1.0), 3) AS temporal_overlap,
       round(rel.reliability, 3) AS reliability,
       rel.attended AS attended,
       rel.no_shows AS no_shows,
       round(exp(-mob.avg_dist / {radius_m: UInt32}), 3) AS proximity_decay,
       round(shape.fulfillment, 3) AS shape_fulfillment,
       round(least(cand.raw_overlap / 26, 1.0) * rel.reliability
         * exp(-mob.avg_dist / {radius_m: UInt32}) * shape.fulfillment, 4) AS score
     FROM cand
     INNER JOIN rel ON rel.user_id = cand.user_id
     INNER JOIN mob ON mob.user_id = cand.user_id
     LEFT JOIN shape ON shape.dist_bucket = intDiv(mob.avg_dist, 1000)
     ORDER BY score DESC
     LIMIT 12`,
    {
      org_id: orgId,
      user_id: userId,
      weekday,
      start_min: startMin,
      duration_min: durationMin,
      radius_m: radiusM,
    },
  );

  const ids = rows.map((r) => Number(r.candidate_id));
  const names = ids.length
    ? await pg.query("SELECT id, display_name, zip FROM users WHERE id = ANY($1)", [ids])
    : { rows: [] };
  const byId = new Map(names.rows.map((n) => [Number(n.id), n]));

  return NextResponse.json({
    candidates: rows.map((r) => ({
      candidate_id: Number(r.candidate_id),
      name: byId.get(Number(r.candidate_id))?.display_name ?? `#${r.candidate_id}`,
      zip: byId.get(Number(r.candidate_id))?.zip,
      temporal_overlap: r.temporal_overlap,
      reliability: r.reliability,
      attended: Number(r.attended),
      no_shows: Number(r.no_shows),
      proximity_decay: r.proximity_decay,
      shape_fulfillment: r.shape_fulfillment,
      score: r.score,
    })),
    ...stats,
  });
}
