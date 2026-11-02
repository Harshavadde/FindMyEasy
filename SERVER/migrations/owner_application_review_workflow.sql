-- Review before applying to the intended PostgreSQL database.
-- Adds Admin decision history and invitation records without changing
-- existing application, user, owner, or listing records.
BEGIN;

ALTER TABLE public.owner_applications
    DROP CONSTRAINT IF EXISTS ck_owner_applications_status;

ALTER TABLE public.owner_applications
    ADD CONSTRAINT ck_owner_applications_status
    CHECK (
        status IN (
            'SUBMITTED',
            'UNDER_REVIEW',
            'ADDITIONAL_INFORMATION_REQUIRED',
            'APPROVED',
            'REJECTED',
            'INVITATION_SENT',
            'INVITATION_ACCEPTED',
            'EXPIRED'
        )
    );

CREATE TABLE public.owner_application_history (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL
        REFERENCES public.owner_applications(id) ON DELETE RESTRICT,
    previous_status VARCHAR(40),
    new_status VARCHAR(40) NOT NULL,
    action VARCHAR(40) NOT NULL,
    message TEXT,
    internal_note TEXT,
    performed_by_admin_id VARCHAR(36) NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_owner_application_history_application_created
    ON public.owner_application_history (application_id, created_at);

CREATE TABLE public.owner_invitations (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL
        REFERENCES public.owner_applications(id) ON DELETE RESTRICT,
    invited_phone VARCHAR(15) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_admin_id VARCHAR(36) NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    delivery_channel VARCHAR(20),
    delivery_status VARCHAR(24) NOT NULL DEFAULT 'NOT_CONFIGURED',
    CONSTRAINT ck_owner_invitations_delivery_status
        CHECK (
            delivery_status IN (
                'NOT_CONFIGURED',
                'PENDING',
                'DELIVERED',
                'FAILED'
            )
        )
);

CREATE INDEX ix_owner_invitations_application_created
    ON public.owner_invitations (application_id, created_at);

CREATE INDEX ix_owner_invitations_expires_at
    ON public.owner_invitations (expires_at);

COMMIT;
