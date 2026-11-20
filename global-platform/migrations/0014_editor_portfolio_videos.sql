-- Editor portfolio video uploads and review workflow
CREATE TABLE IF NOT EXISTS editor_portfolio_videos (
 id TEXT PRIMARY KEY,
 editor_id TEXT NOT NULL REFERENCES editor_profiles(user_id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 category TEXT NOT NULL,
 r2_object_key TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('video/mp4','video/quicktime')),
 size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 83886080),
 rights_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(rights_confirmed IN (0,1)),
 terms_version TEXT NOT NULL,
 terms_accepted_at TEXT NOT NULL,
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
 client_visible INTEGER NOT NULL DEFAULT 0 CHECK(client_visible IN (0,1)),
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TEXT,
 review_note TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_editor_portfolio_review ON editor_portfolio_videos(review_status,created_at);
CREATE INDEX IF NOT EXISTS idx_editor_portfolio_editor ON editor_portfolio_videos(editor_id,created_at);
