CREATE TABLE IF NOT EXISTS messages (
    id         BIGSERIAL PRIMARY KEY,
    from_id    BIGINT NOT NULL REFERENCES users(id),
    to_id      BIGINT NOT NULL REFERENCES users(id),
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages (least(from_id, to_id), greatest(from_id, to_id), created_at);
