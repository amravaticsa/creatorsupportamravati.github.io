-- Isolated CSA video editing workflow staging schema.
-- Apply only to csa-video-workflow-staging. No production records or media copied.
CREATE TABLE video_editing_orders (
 id TEXT PRIMARY KEY, order_code TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT, country TEXT, service_package TEXT, project_type TEXT, video_duration TEXT, aspect_ratio TEXT, deadline TEXT, instructions TEXT, quoted_amount_paise INTEGER DEFAULT 0, currency TEXT DEFAULT 'INR', payment_status TEXT DEFAULT 'pending', order_status TEXT NOT NULL DEFAULT 'order_received', customer_access_hash TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, is_draft INTEGER NOT NULL DEFAULT 0, payment_reference TEXT, payment_amount_paise INTEGER, payment_type TEXT, project_budget_paise INTEGER, terms_version TEXT, terms_accepted_at TEXT, rush_quote_id TEXT, rush_level TEXT, rush_surcharge_paise INTEGER NOT NULL DEFAULT 0, rush_total_paise INTEGER
);
CREATE TABLE video_editing_files (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, original_filename TEXT NOT NULL, content_type TEXT, file_size_bytes INTEGER NOT NULL DEFAULT 0, file_role TEXT NOT NULL DEFAULT 'raw', uploaded_by TEXT NOT NULL DEFAULT 'customer', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, multipart_upload_id TEXT, upload_state TEXT NOT NULL DEFAULT 'pending', FOREIGN KEY(order_id) REFERENCES video_editing_orders(id) ON DELETE CASCADE
);
CREATE TABLE video_editing_upload_parts (
 id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES video_editing_files(id) ON DELETE CASCADE, part_number INTEGER NOT NULL, etag TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(file_id,part_number)
);
CREATE TABLE video_editing_status_history (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL, old_status TEXT, new_status TEXT NOT NULL, note TEXT, changed_by TEXT NOT NULL DEFAULT 'system', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(order_id) REFERENCES video_editing_orders(id) ON DELETE CASCADE
);
CREATE TABLE orders (
 id TEXT PRIMARY KEY, razorpay_order_id TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT NOT NULL, project_total_paise INTEGER NOT NULL, amount_due_paise INTEGER NOT NULL, payment_type TEXT NOT NULL CHECK(payment_type IN ('advance','full')), status TEXT NOT NULL DEFAULT 'created', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, whatsapp_opt_in INTEGER NOT NULL DEFAULT 0, project_ref TEXT, rush_quote_id TEXT
);
CREATE TABLE payments (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL, razorpay_payment_id TEXT NOT NULL UNIQUE, amount_paise INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'INR', status TEXT NOT NULL, method TEXT, captured_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(order_id) REFERENCES orders(id)
);
CREATE INDEX idx_video_orders_draft ON video_editing_orders(order_code,is_draft);
CREATE INDEX idx_video_files_order ON video_editing_files(order_id,created_at);
CREATE INDEX idx_video_upload_parts_file ON video_editing_upload_parts(file_id,part_number);
CREATE INDEX idx_rush_payment_quote ON orders(rush_quote_id);
