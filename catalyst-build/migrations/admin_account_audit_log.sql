BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_account_audit_log (
    id VARCHAR(36) PRIMARY KEY,
    actor_admin_id VARCHAR(36) NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,
    target_admin_id VARCHAR(36) NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,
    action VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
