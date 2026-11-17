-- Fixed-window, IP-hashed rate limits for public/authenticated expensive endpoints.
-- Only a one-way SHA-256 digest is stored; raw client IP addresses are not persisted.
CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL CHECK (hits > 0),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expiry
  ON api_rate_limits(expires_at);
