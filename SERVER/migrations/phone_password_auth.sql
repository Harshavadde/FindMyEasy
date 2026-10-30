BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(15);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS user_role VARCHAR(10) NOT NULL DEFAULT 'SEEKER';

ALTER TABLE public.users
    ALTER COLUMN email DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.users
        WHERE phone_number IS NOT NULL
        GROUP BY phone_number
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Phone authentication migration stopped: duplicate phone_number values already exist.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.users AS candidate
        JOIN public.users AS existing
          ON existing.phone_number = '+91' || candidate.phone
         AND existing.id <> candidate.id
        WHERE candidate.phone_number IS NULL
          AND candidate.phone ~ '^[6-9][0-9]{9}$'
    ) OR EXISTS (
        SELECT 1
        FROM public.users
        WHERE phone_number IS NULL
          AND phone ~ '^[6-9][0-9]{9}$'
        GROUP BY phone
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Phone authentication migration stopped: legacy phone values would create duplicate normalized phone numbers.';
    END IF;
END;
$$;

UPDATE public.users
SET phone_number = '+91' || phone
WHERE phone_number IS NULL
  AND phone ~ '^[6-9][0-9]{9}$';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class AS existing_object
        JOIN pg_namespace AS object_namespace
          ON object_namespace.oid = existing_object.relnamespace
        WHERE object_namespace.nspname = 'public'
          AND existing_object.relname = 'ix_users_phone_number'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_class AS index_relation
        JOIN pg_namespace AS index_namespace
          ON index_namespace.oid = index_relation.relnamespace
        JOIN pg_index AS index_metadata
          ON index_metadata.indexrelid = index_relation.oid
        JOIN pg_am AS access_method
          ON access_method.oid = index_relation.relam
        JOIN pg_attribute AS indexed_column
          ON indexed_column.attrelid = index_metadata.indrelid
         AND indexed_column.attnum = index_metadata.indkey[0]
        WHERE index_namespace.nspname = 'public'
          AND index_relation.relname = 'ix_users_phone_number'
          AND index_relation.relkind = 'i'
          AND index_metadata.indrelid = 'public.users'::regclass
          AND index_metadata.indisunique
          AND index_metadata.indisvalid
          AND index_metadata.indisready
          AND index_metadata.indislive
          AND index_metadata.indpred IS NULL
          AND index_metadata.indexprs IS NULL
          AND index_metadata.indnatts = 1
          AND index_metadata.indnkeyatts = 1
          AND access_method.amname = 'btree'
          AND indexed_column.attname = 'phone_number'
    ) THEN
        RAISE EXCEPTION
            'Phone authentication migration stopped: ix_users_phone_number exists but is not the expected unique B-tree index on public.users(phone_number).';
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone_number
    ON public.users (phone_number);

COMMIT;
