ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS activities (
    id          BIGSERIAL PRIMARY KEY,
    host_id     BIGINT NOT NULL REFERENCES users(id),
    org_id      BIGINT NOT NULL REFERENCES orgs(id),
    title       TEXT NOT NULL,
    starts_at   TIMESTAMPTZ NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 60,
    place_label TEXT NOT NULL,
    capacity    INTEGER NOT NULL DEFAULT 6,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_members (
    activity_id BIGINT NOT NULL REFERENCES activities(id),
    user_id     BIGINT NOT NULL REFERENCES users(id),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(org_id, starts_at);
