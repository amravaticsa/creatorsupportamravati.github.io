-- Store a server-computed SHA-256 digest for each uploaded part.
-- Existing rows remain NULL and are deliberately not eligible for safe resume.
ALTER TABLE multipart_upload_parts ADD COLUMN sha256 TEXT;
