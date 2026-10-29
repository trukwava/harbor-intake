-- Migration 001; applied idempotently at startup. Local demo identity is server-owned.
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS opportunities (
 id TEXT PRIMARY KEY,
 org TEXT NOT NULL,
 data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- Versioned aggregates preserve source originals, page labels, extraction runs,
-- citations, reviewer values, decisions and audit events in one atomic write.
-- JSON domain validation occurs before write; SQLite guarantees durable atomic commits.
