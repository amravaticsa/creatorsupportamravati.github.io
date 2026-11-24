-- Add the country order-enable flag required by the Super Admin country-registry sync.
-- Apply only after PRAGMA table_info(countries) confirms the column is absent.
-- Existing countries remain disabled until legal approval and explicit activation.
ALTER TABLE countries
  ADD COLUMN orders_enabled INTEGER NOT NULL DEFAULT 0
  CHECK(orders_enabled IN (0,1));
