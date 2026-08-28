-- SURFACE — who's drifting: deficit-hour trajectory per user, month over month,
-- ranked by slope, filtered to those unmatched recently. Parameter: {org_id}.
-- Attendance is a level; the trajectory is the signal.

WITH
  monthly AS (
    SELECT
      user_id,
      toStartOfMonth(event_time)                       AS month,
      countIf(event_type = 'declared' AND kind = 'deficit') AS deficit_hours,
      countIf(event_type = 'attended')                 AS attended
    FROM surplus.hour_events
    WHERE org_id = {org_id:UInt32}
      AND event_time > now() - INTERVAL 8 MONTH
    GROUP BY user_id, month
  ),
  slopes AS (
    SELECT
      user_id,
      -- least-squares slope of deficit_hours over month index
      covarPop(toUnixTimestamp(month) / 2592000, deficit_hours)
        / greatest(varPop(toUnixTimestamp(month) / 2592000), 0.001) AS slope,
      sum(deficit_hours)  AS total_deficit,
      sum(attended)       AS total_attended,
      count()             AS months_active
    FROM monthly
    GROUP BY user_id
    HAVING months_active >= 4 AND total_deficit > 10
  ),
  last_match AS (
    SELECT user_id, max(event_time) AS last_matched
    FROM surplus.hour_events
    WHERE org_id = {org_id:UInt32} AND event_type IN ('proposed', 'accepted')
    GROUP BY user_id
  )
SELECT
  s.user_id,
  round(s.slope, 2)      AS deficit_slope,
  s.total_deficit,
  s.total_attended,
  lm.last_matched
FROM slopes s
LEFT JOIN last_match lm ON lm.user_id = s.user_id
WHERE lm.last_matched < now() - INTERVAL 3 WEEK OR lm.last_matched IS NULL
ORDER BY s.slope DESC
LIMIT 15
