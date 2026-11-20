-- Store complete international editor address details.
ALTER TABLE editor_profiles ADD COLUMN country_code TEXT;
ALTER TABLE editor_profiles ADD COLUMN state TEXT;
ALTER TABLE editor_profiles ADD COLUMN district TEXT;
ALTER TABLE editor_profiles ADD COLUMN village TEXT;
ALTER TABLE editor_profiles ADD COLUMN postal_code TEXT;
ALTER TABLE editor_profiles ADD COLUMN address_line TEXT;
