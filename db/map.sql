-- MAP — freight map: surplus vs deficit density, org × weekday × 30-min band.
-- Parameter: {org_id}. Hits mv_band_density when fresh volume allows; the raw
-- form below is the honest full-scan version for the latency readout.

SELECT
  weekday,
  intDiv(start_min, 30)                    AS band,
  countIf(kind = 'surplus')                AS surplus,
  countIf(kind = 'deficit')                AS deficit
FROM surplus.hour_events
WHERE org_id = {org_id:UInt32}
  AND event_type = 'declared'
GROUP BY weekday, band
ORDER BY weekday, band
