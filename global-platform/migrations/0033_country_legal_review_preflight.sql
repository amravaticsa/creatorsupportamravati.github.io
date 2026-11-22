-- READ-ONLY preflight for migration 0033.
-- Run separately against the exact target D1 only after verifying its Worker binding UUID.
-- No INSERT, UPDATE, DELETE, DDL, transaction, or data export is performed.
PRAGMA table_info(country_legal_reviews);
PRAGMA index_list(country_legal_reviews);
SELECT type,name,sql
FROM sqlite_master
WHERE name='country_legal_reviews'
   OR name LIKE 'idx_country_legal_reviews_%'
   OR name LIKE 'trg_country_legal_reviews_%'
ORDER BY type,name;
SELECT COUNT(*) AS country_legal_review_rows FROM country_legal_reviews;
