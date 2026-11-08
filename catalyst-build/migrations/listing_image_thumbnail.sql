BEGIN;

ALTER TABLE public.listing_images
    ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500);

COMMIT;
