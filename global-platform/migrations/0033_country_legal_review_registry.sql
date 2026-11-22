-- Evidence-backed country legal review history for Global API country activation.
-- Additive and safe to apply where the table already exists; immutable review records.
CREATE TABLE IF NOT EXISTS country_legal_reviews (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL REFERENCES countries(country_code) ON DELETE CASCADE,
  review_status TEXT NOT NULL CHECK(review_status IN ('pending','approved','rejected')),
  reviewer_source_admin_id TEXT NOT NULL,
  evidence_reference TEXT,
  legal_notes TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_country_legal_reviews_country_created
  ON country_legal_reviews(country_code,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_country_legal_reviews_insert_guard
BEFORE INSERT ON country_legal_reviews
WHEN length(trim(NEW.reviewer_source_admin_id)) < 3
  OR length(NEW.country_code) <> 2
  OR NEW.country_code <> upper(NEW.country_code)
  OR NEW.country_code GLOB '*[^A-Z]*'
  OR length(COALESCE(NEW.evidence_reference,'')) > 1000
  OR length(COALESCE(NEW.legal_notes,'')) > 5000
  OR (NEW.review_status = 'approved' AND trim(COALESCE(NEW.evidence_reference,'')) = '')
BEGIN
  SELECT RAISE(ABORT,'country_legal_review_requires_valid_reviewer_and_evidence');
END;

CREATE TRIGGER IF NOT EXISTS trg_country_legal_reviews_no_update
BEFORE UPDATE ON country_legal_reviews
BEGIN
  SELECT RAISE(ABORT,'country_legal_reviews_are_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_country_legal_reviews_no_delete
BEFORE DELETE ON country_legal_reviews
BEGIN
  SELECT RAISE(ABORT,'country_legal_reviews_are_immutable');
END;
