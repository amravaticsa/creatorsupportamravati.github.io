-- Tighten the reviewed identity lifecycle without changing or copying any records.
-- Apply only to the isolated Global API staging D1 after migration review.

CREATE TRIGGER IF NOT EXISTS trg_legacy_editor_link_insert_review_guard
BEFORE INSERT ON legacy_editor_identity_links
WHEN
  (NEW.link_status = 'active' AND (
    NEW.reviewed_by IS NULL OR length(trim(NEW.reviewed_by)) = 0 OR
    NEW.reviewed_at IS NULL OR length(trim(NEW.reviewed_at)) = 0 OR
    NEW.review_note IS NULL OR length(trim(NEW.review_note)) < 3
  ))
  OR
  (NEW.link_status = 'revoked' AND (
    NEW.reviewed_by IS NULL OR length(trim(NEW.reviewed_by)) = 0 OR
    NEW.revoked_at IS NULL OR length(trim(NEW.revoked_at)) = 0 OR
    NEW.review_note IS NULL OR length(trim(NEW.review_note)) < 3
  ))
BEGIN
  SELECT RAISE(ABORT, 'legacy_editor_link_review_audit_required');
END;

CREATE TRIGGER IF NOT EXISTS trg_legacy_editor_link_update_review_guard
BEFORE UPDATE ON legacy_editor_identity_links
WHEN
  (OLD.link_status = 'revoked' AND NEW.link_status <> 'revoked')
  OR
  (OLD.link_status = 'active' AND NEW.link_status = 'pending')
  OR
  (NEW.link_status = 'active' AND (
    NEW.reviewed_by IS NULL OR length(trim(NEW.reviewed_by)) = 0 OR
    NEW.reviewed_at IS NULL OR length(trim(NEW.reviewed_at)) = 0 OR
    NEW.review_note IS NULL OR length(trim(NEW.review_note)) < 3
  ))
  OR
  (NEW.link_status = 'revoked' AND (
    NEW.reviewed_by IS NULL OR length(trim(NEW.reviewed_by)) = 0 OR
    NEW.revoked_at IS NULL OR length(trim(NEW.revoked_at)) = 0 OR
    NEW.review_note IS NULL OR length(trim(NEW.review_note)) < 3
  ))
BEGIN
  SELECT RAISE(ABORT, 'legacy_editor_link_transition_or_audit_invalid');
END;
