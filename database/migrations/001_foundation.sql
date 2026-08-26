-- GreenPlace Database Schema - Phase 1 Foundation
-- This is a placeholder migration. Full schema will be added in Phase 2.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- This migration will be replaced with the full schema in Phase 2
-- For now, just creating a placeholder to verify database connectivity

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO schema_version (version) VALUES (1) ON CONFLICT DO NOTHING;