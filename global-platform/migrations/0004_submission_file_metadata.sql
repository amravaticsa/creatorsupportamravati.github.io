ALTER TABLE work_submissions ADD COLUMN original_filename TEXT;
ALTER TABLE work_submissions ADD COLUMN mime_type TEXT;
ALTER TABLE work_submissions ADD COLUMN size_bytes INTEGER;