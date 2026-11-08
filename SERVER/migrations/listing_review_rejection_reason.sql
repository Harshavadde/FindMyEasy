ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
