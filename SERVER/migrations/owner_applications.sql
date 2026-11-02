BEGIN;

CREATE TABLE IF NOT EXISTS public.owner_applications (
    id VARCHAR(36) PRIMARY KEY,
    application_reference VARCHAR(24) NOT NULL UNIQUE,
    applicant_name VARCHAR(150) NOT NULL,
    applicant_phone VARCHAR(15) NOT NULL,
    applicant_email VARCHAR(255),
    relationship_type VARCHAR(40) NOT NULL,
    pg_name VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL,
    area VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    formatted_address TEXT,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    google_place_id VARCHAR(255),
    google_maps_url VARCHAR(2048),
    status VARCHAR(40) NOT NULL DEFAULT 'SUBMITTED',
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    declaration_version VARCHAR(32) NOT NULL DEFAULT 'owner-partnership-v1',
    declaration_accepted_at TIMESTAMPTZ NOT NULL,
    status_access_hash VARCHAR(64) NOT NULL UNIQUE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_owner_applications_relationship_type
        CHECK (
            relationship_type IN (
                'PROPERTY_OWNER',
                'PROPERTY_MANAGER',
                'AUTHORIZED_REPRESENTATIVE'
            )
        ),
    CONSTRAINT ck_owner_applications_status
        CHECK (
            status IN (
                'SUBMITTED',
                'UNDER_REVIEW',
                'ADDITIONAL_INFORMATION_REQUIRED',
                'APPROVED',
                'REJECTED'
            )
        ),
    CONSTRAINT ck_owner_applications_latitude
        CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT ck_owner_applications_longitude
        CHECK (longitude >= -180 AND longitude <= 180)
);

CREATE INDEX IF NOT EXISTS ix_owner_applications_status_submitted_at
    ON public.owner_applications (status, submitted_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_applications_active_duplicate
    ON public.owner_applications (
        lower(applicant_phone),
        lower(pg_name),
        lower(city),
        lower(area),
        lower(address)
    )
    WHERE status = 'SUBMITTED';

COMMIT;
