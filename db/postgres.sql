-- SURPLUS — Postgres schema (spec §5)

CREATE TABLE orgs (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('senior_center', 'campus', 'neighborhood'))
);

CREATE TABLE users (
    id           BIGSERIAL PRIMARY KEY,
    display_name TEXT NOT NULL,
    org_id       BIGINT NOT NULL REFERENCES orgs(id),
    zip          TEXT NOT NULL,
    seeded       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consent (
    user_id     BIGINT NOT NULL REFERENCES users(id),
    share_level TEXT NOT NULL DEFAULT 'org',
    revoked_at  TIMESTAMPTZ,
    PRIMARY KEY (user_id)
);

CREATE TABLE availability (
    id        BIGSERIAL PRIMARY KEY,
    user_id   BIGINT NOT NULL REFERENCES users(id),
    weekday   SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_min SMALLINT NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
    end_min   SMALLINT NOT NULL CHECK (end_min BETWEEN 1 AND 1440),
    kind      TEXT NOT NULL CHECK (kind IN ('surplus', 'deficit')),
    radius_m  INTEGER NOT NULL DEFAULT 2000
);

CREATE TABLE matches (
    id          BIGSERIAL PRIMARY KEY,
    user_a      BIGINT NOT NULL REFERENCES users(id),
    user_b      BIGINT NOT NULL REFERENCES users(id),
    slot_start  TIMESTAMPTZ NOT NULL,
    slot_end    TIMESTAMPTZ NOT NULL,
    place_label TEXT,
    state       TEXT NOT NULL DEFAULT 'proposed'
                CHECK (state IN ('proposed', 'accepted', 'declined', 'completed', 'no_show')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_availability_user ON availability(user_id);
CREATE INDEX idx_matches_users ON matches(user_a, user_b);
