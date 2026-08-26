-- ============================================================
-- GreenPlace Database Schema - Phase 1 Foundation
-- Enables required PostgreSQL extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO schema_version (version, description)
VALUES (1, 'Initial foundation - extensions and version tracking')
ON CONFLICT (version) DO NOTHING;
