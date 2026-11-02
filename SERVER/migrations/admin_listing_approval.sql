-- Run once before deploying admin approval enforcement.
-- Preserve every legacy listing that the current public API exposes.
BEGIN;

UPDATE listings
SET status = 'published'
WHERE status IN ('draft', 'active', 'pending', 'under_review');

COMMIT;
