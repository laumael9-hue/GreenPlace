-- ============================================================
-- 011: Webhook Events (PayMongo deduplication)
-- ============================================================

CREATE TABLE webhook_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        VARCHAR(255) NOT NULL UNIQUE,
    event_type      VARCHAR(100) NOT NULL,
    payload         JSONB,
    processed       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages webhook events"
    ON webhook_events FOR ALL
    USING (TRUE);
