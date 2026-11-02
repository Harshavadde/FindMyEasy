-- Review before applying to the intended PostgreSQL database.
-- Adds nullable Owner account linkage and registration completion time only.
BEGIN;

ALTER TABLE public.owner_applications
    ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR(36);

ALTER TABLE public.owner_applications
    ADD COLUMN IF NOT EXISTS registration_completed_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_owner_applications_owner_user_id_users'
          AND conrelid = 'public.owner_applications'::regclass
    ) THEN
        ALTER TABLE public.owner_applications
            ADD CONSTRAINT fk_owner_applications_owner_user_id_users
            FOREIGN KEY (owner_user_id)
            REFERENCES public.users(id)
            ON DELETE RESTRICT;
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_applications_owner_user_id
    ON public.owner_applications (owner_user_id)
    WHERE owner_user_id IS NOT NULL;

COMMIT;
