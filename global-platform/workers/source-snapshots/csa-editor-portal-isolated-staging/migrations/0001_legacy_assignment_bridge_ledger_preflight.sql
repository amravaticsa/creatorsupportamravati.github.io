-- READ-ONLY PREFLIGHT ONLY. Do not use this file as a migration.
-- Execute only against the owner-confirmed isolated staging database.
-- Every statement below is SELECT or PRAGMA; no schema/data writes occur.

-- 1. Confirm database identity outside SQL by checking the D1 UUID/binding.
-- 2. Inspect the actual legacy table definitions.
PRAGMA table_info(video_editors);
PRAGMA table_info(video_editing_orders);
PRAGMA table_info(video_editing_assignments);

-- 3. Inspect indexes and uniqueness constraints.
PRAGMA index_list(video_editors);
PRAGMA index_list(video_editing_orders);
PRAGMA index_list(video_editing_assignments);

-- 4. Inspect triggers that may affect order/assignment lifecycle.
SELECT name, tbl_name, sql
FROM sqlite_master
WHERE type = 'trigger'
  AND tbl_name IN ('video_editors','video_editing_orders','video_editing_assignments')
ORDER BY tbl_name, name;

-- 5. Inspect table SQL, foreign keys and indexes from the schema catalog.
SELECT type, name, tbl_name, sql
FROM sqlite_master
WHERE type IN ('table','index')
  AND tbl_name IN ('video_editors','video_editing_orders','video_editing_assignments')
ORDER BY type, tbl_name, name;

-- 6. Counts only; no customer/editor row contents are exposed.
SELECT 'video_editors' AS table_name, COUNT(*) AS row_count FROM video_editors;
SELECT 'video_editing_orders' AS table_name, COUNT(*) AS row_count FROM video_editing_orders;
SELECT 'video_editing_assignments' AS table_name, COUNT(*) AS row_count FROM video_editing_assignments;

-- 7. Check whether an order can have multiple assignment rows.
-- Review the real column names from PRAGMA table_info first; do not guess.
-- Run a grouped duplicate check only after confirming the order FK column.

-- 8. Check for existing bridge ledger before considering an additive migration.
SELECT name, sql
FROM sqlite_master
WHERE type = 'table'
  AND name = 'legacy_assignment_bridge_ledger';
