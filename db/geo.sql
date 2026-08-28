ALTER TABLE users ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Each org gets a center scattered over the SF Bay; people jitter ~1 km
-- around their org, deterministically from their id.
WITH centers AS (
  SELECT id,
    37.72 + (abs(hashtext(id::text || 'lat')) % 1000) / 1000.0 * 0.14 AS clat,
    -122.51 + (abs(hashtext(id::text || 'lng')) % 1000) / 1000.0 * 0.20 AS clng
  FROM orgs
)
UPDATE users u SET
  lat = c.clat + (abs(hashtext(u.id::text || 'a')) % 2000 - 1000) / 1000.0 * 0.008,
  lng = c.clng + (abs(hashtext(u.id::text || 'b')) % 2000 - 1000) / 1000.0 * 0.010
FROM centers c WHERE c.id = u.org_id AND u.lat IS NULL;

-- Org 1 is the Japantown senior center: anchor it there for the demo.
UPDATE users SET
  lat = 37.7852 + (abs(hashtext(id::text || 'a')) % 2000 - 1000) / 1000.0 * 0.006,
  lng = -122.4300 + (abs(hashtext(id::text || 'b')) % 2000 - 1000) / 1000.0 * 0.008
WHERE org_id = 1;

UPDATE activities a SET
  lat = u.lat + 0.0015, lng = u.lng + 0.0015
FROM users u WHERE u.id = a.host_id AND a.lat IS NULL;
