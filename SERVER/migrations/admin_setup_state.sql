BEGIN;

CREATE TABLE IF NOT EXISTS admin_setup_state (
    setup_key VARCHAR(32) PRIMARY KEY,
    admin_user_id VARCHAR(36),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_admin_setup_state_initial_key
        CHECK (setup_key = 'initial-admin')
);

INSERT INTO admin_setup_state (setup_key, admin_user_id)
SELECT 'initial-admin', id
FROM users
WHERE user_role = 'ADMIN'
LIMIT 1
ON CONFLICT (setup_key) DO NOTHING;

COMMIT;
