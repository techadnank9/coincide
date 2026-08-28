-- SURPLUS — ClickHouse schema (spec §5)

CREATE DATABASE IF NOT EXISTS surplus;

CREATE TABLE IF NOT EXISTS surplus.hour_events (
    event_time      DateTime64(3),
    event_type      LowCardinality(String),
    user_id         UInt64,
    counterpart_id  UInt64,
    org_id          UInt32,
    weekday         UInt8,
    start_min       UInt16,
    duration_min    UInt16,
    kind            LowCardinality(String),
    distance_m      UInt32,
    group_size      UInt8,
    lead_time_min   Int32,
    match_id        UInt64
) ENGINE = MergeTree
ORDER BY (org_id, weekday, start_min, user_id);

-- Reliability: attended vs no_show per user
CREATE MATERIALIZED VIEW IF NOT EXISTS surplus.mv_reliability
ENGINE = AggregatingMergeTree
ORDER BY (user_id)
AS SELECT
    user_id,
    countIfState(event_type = 'attended') AS attended,
    countIfState(event_type = 'no_show')  AS no_shows
FROM surplus.hour_events
WHERE event_type IN ('attended', 'no_show')
GROUP BY user_id;

-- Band density: the freight map (org × weekday × 30-min band × kind)
CREATE MATERIALIZED VIEW IF NOT EXISTS surplus.mv_band_density
ENGINE = SummingMergeTree
ORDER BY (org_id, weekday, band, kind)
AS SELECT
    org_id,
    weekday,
    intDiv(start_min, 30) AS band,
    kind,
    count() AS declared_count
FROM surplus.hour_events
WHERE event_type = 'declared'
GROUP BY org_id, weekday, band, kind;

-- Shape outcomes: historical success by distance bucket × group size × lead-time bucket
CREATE MATERIALIZED VIEW IF NOT EXISTS surplus.mv_shape_outcomes
ENGINE = AggregatingMergeTree
ORDER BY (dist_bucket, group_size, lead_bucket)
AS SELECT
    intDiv(distance_m, 1000)              AS dist_bucket,
    group_size,
    multiIf(lead_time_min < 60, 0,
            lead_time_min < 1440, 1,
            lead_time_min < 4320, 2, 3)   AS lead_bucket,
    countIfState(event_type = 'attended') AS attended,
    countIfState(event_type = 'no_show')  AS no_shows
FROM surplus.hour_events
WHERE event_type IN ('attended', 'no_show')
GROUP BY dist_bucket, group_size, lead_bucket;
