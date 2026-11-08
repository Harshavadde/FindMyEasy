# FindEasy API

## Authentication

Login accepts either an email address or an Indian phone number with a
password. Phone numbers are normalized to `+91XXXXXXXXXX`. Public
email/password or phone/password registration creates a SEEKER account;
OWNER accounts are created through the approved owner-invitation workflow,
and ADMIN accounts are created by an authenticated existing ADMIN or trusted
server-side provisioning.
Passwords remain required; phone-only accounts without a password cannot
authenticate until a secure recovery path is restored.

Set `JWT_SECRET_KEY` to at least 32 random bytes in every environment. Keep
database credentials and signing secrets in server-side environment settings;
never put them in the Expo client. `AUTH_SECRET_KEY` remains a supported
environment-variable alias for existing deployments.

## OTP provider

The prior OTP routes and 2Factor integration remain available for future
reintroduction, but `PHONE_OTP_ENABLED` defaults to `false`. With it disabled,
both OTP routes return 404 and do not call the provider. Do not enable it for
the current password-based signup/login experience. `OTP_SECRET_SALT` and
`TWOFACTOR_API_KEY` are only needed if the provider flow is intentionally
re-enabled. There is no fixed development OTP.

## Database migration

Admin listing rejection reasons are stored in the nullable
`listings.rejection_reason` column. Before deploying the updated Admin API,
apply [`migrations/listing_review_rejection_reason.sql`](./migrations/listing_review_rejection_reason.sql)
to the Development database. This additive migration does not rewrite or
remove existing listing data.

Admin account creation and disabling are recorded in
`admin_account_audit_log`. Before deploying those endpoints, apply
[`migrations/admin_account_audit_log.sql`](./migrations/admin_account_audit_log.sql)
to the Development database. It creates a new audit table and preserves all
existing account and listing records.

New listing images include a cached WebP preview. Before deploying the image
upload update, apply
[`migrations/listing_image_thumbnail.sql`](./migrations/listing_image_thumbnail.sql)
to the Development database. Existing image URLs remain unchanged and continue
to serve as the fallback when no preview is available.

Review and, only when explicitly approved for the selected database, run
[`migrations/phone_password_auth.sql`](./migrations/phone_password_auth.sql).
It is a narrow PostgreSQL migration that adds `phone_number`,
`is_phone_verified`, and `user_role`; makes `email` nullable; backfills only
valid legacy ten-digit Indian `phone` values; and creates the unique
`ix_users_phone_number` index after duplicate checks.

It preserves the legacy `phone` column, leaves `password_hash` NOT NULL, never
changes listings or other tables, and stops if legacy phone values would
collide. It is not run automatically by the API or `migrate.py`. Do not use
the broad `migrate.py` for this change.

## Local validation

Install dependencies, configure an isolated test database, then run:

```powershell
python -m pip install -r requirements.txt
python -m unittest discover -s tests
uvicorn app.main:app --reload
```

Tests use in-memory SQLite and mock all OTP provider calls. No SMS is sent.
