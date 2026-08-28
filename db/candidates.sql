-- ROUTE — the matching query (spec §4). Parameters: {org_id}, {user_id},
-- {weekday}, {start_min}, {duration_min}, {radius_m}.
-- score = temporal_overlap × reliability × proximity_decay × shape_fulfillment
-- Component scores are exposed per candidate — legibility over magic numbers.

WITH
  -- candidates: users in this org who declared complementary hours near the slot
  cand AS (
    SELECT
      user_id,
      -- temporal overlap: how much of their declared hours cover the slot
      sum(greatest(0,
        least(start_min + duration_min, {start_min:UInt16} + {duration_min:UInt16})
        - greatest(start_min, {start_min:UInt16})
      )) / {duration_min:UInt16} AS raw_overlap
    FROM surplus.hour_events
    WHERE org_id = {org_id:UInt32}
      AND weekday = {weekday:UInt8}
      AND event_type = 'declared'
      AND kind = 'surplus'
      AND user_id != {user_id:UInt64}
      AND event_time > now() - INTERVAL 6 MONTH
    GROUP BY user_id
    HAVING raw_overlap > 0
  ),
  -- typical meeting distance per user, from their match history
  mob AS (
    SELECT user_id, avg(distance_m) AS avg_dist
    FROM surplus.hour_events
    WHERE org_id = {org_id:UInt32}
      AND event_type IN ('proposed', 'attended', 'no_show')
      AND distance_m > 0
    GROUP BY user_id
  ),
  rel AS (
    SELECT
      user_id,
      countIf(event_type = 'attended')                        AS attended,
      countIf(event_type = 'no_show')                         AS no_shows,
      (attended + 1) / (attended + no_shows + 2)              AS reliability  -- Laplace-smoothed
    FROM surplus.hour_events
    WHERE org_id = {org_id:UInt32}
      AND event_type IN ('attended', 'no_show')
      AND event_time > now() - INTERVAL 6 MONTH
    GROUP BY user_id
  ),
  -- shape fulfillment: org-wide historical success at this distance bucket × pair size
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
  cand.user_id                                            AS candidate_id,
  -- fraction of the last 26 weeks their declared surplus covered this slot
  round(least(cand.raw_overlap / 26, 1.0), 3)             AS temporal_overlap,
  round(rel.reliability, 3)                               AS reliability,
  rel.attended                                            AS attended,
  rel.no_shows                                            AS no_shows,
  round(exp(-mob.avg_dist / {radius_m:UInt32}), 3)        AS proximity_decay,
  round(shape.fulfillment, 3)                             AS shape_fulfillment,
  round(
    least(cand.raw_overlap / 26, 1.0)
    * rel.reliability
    * exp(-mob.avg_dist / {radius_m:UInt32})
    * shape.fulfillment, 4)                               AS score
FROM cand
INNER JOIN rel   ON rel.user_id = cand.user_id
INNER JOIN mob   ON mob.user_id = cand.user_id
LEFT JOIN shape ON shape.dist_bucket = intDiv(mob.avg_dist, 1000)
ORDER BY score DESC
LIMIT 12
