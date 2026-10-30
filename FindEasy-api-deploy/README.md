# FindEasy FastAPI AppSail deployment

This deployment copy is refreshed from `../SERVER`; make backend source changes
there first. `run.py` starts the FastAPI entry point `app.main:app`.

## Runtime and configuration

- Catalyst stack: Python 3.13
- Startup command: `python3 run.py`
- Bind address: `0.0.0.0`
- AppSail port: `X_ZOHO_CATALYST_LISTEN_PORT` (defaults to 9000)

Set environment values in Catalyst's server-side settings. Never commit or
place secrets in the Expo client.

Required:

- `DATABASE_URL`: PostgreSQL connection URL. Keep the existing Neon Development
  target unless intentionally changing environments.
- `JWT_SECRET_KEY`: at least 32 random bytes for signing access tokens.
- `ENVIRONMENT`: `production` for deployed environments.
- `PUBLIC_BASE_URL`: public AppSail HTTPS base URL.

Phone/password authentication is active. Registration normalizes phone
numbers to `+91XXXXXXXXXX`, requires a password, and leaves
`is_phone_verified=false`. Registration requires at least 8 password
characters. Existing phone-only accounts without passwords
remain blocked until a secure recovery path is restored.

`PHONE_OTP_ENABLED` defaults to `false` and must remain false for this release.
The OTP endpoints return 404 and do not call 2Factor in this state.
`OTP_SECRET_SALT` and `TWOFACTOR_API_KEY` are optional; they are used only if
the OTP provider flow is intentionally re-enabled later. There is no fixed
development OTP.

Optional storage settings include `AWS_ENDPOINT_URL_S3`,
`NEON_STORAGE_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and
`AWS_SECRET_ACCESS_KEY`. Keep all storage credentials server-side.

## Narrow phone-auth migration

Review `SERVER/migrations/phone_password_auth.sql` before applying it to the
selected database. This additive, repeatable migration:

- adds `phone_number`, `is_phone_verified`, and `user_role`;
- makes `email` nullable while leaving `password_hash` NOT NULL;
- backfills only valid ten-digit Indian values from the existing `phone`
  column, without dropping or renaming that column;
- stops if normalized phone values would collide; and
- creates the unique `ix_users_phone_number` index.

It does not modify listings, favorites, images, passwords, or other tables.
The API does not run this SQL automatically. Do not run broad `migrate.py` for
this release; it includes unrelated listings changes and OTP table creation.
Do not run any migration until the intended database is explicitly selected
and approved.

## Local validation

Install dependencies and compile the deployment copy:

```powershell
python -m pip install -r catalyst-build\requirements.txt
python -m compileall -q catalyst-build\app catalyst-build\migrate.py
```

Tests use isolated in-memory SQLite and mocked provider calls. No SMS is sent.

Start locally:

```powershell
$env:X_ZOHO_CATALYST_LISTEN_PORT="9000"
python3 run.py
```

Check `http://localhost:9000/health` and `http://localhost:9000/docs`.

## Catalyst deployment

Run from the `catalyst-build` directory containing `catalyst.json`:

```powershell
catalyst -p 89855000000016028 deploy appsail
```

The manifest selects the existing `FindEasy-api` AppSail service. This command
deploys to Catalyst's Development environment; confirm that is the intended
environment before running it. Configure `ENVIRONMENT=production` and
`PHONE_OTP_ENABLED=false` in Catalyst. Do not deploy automatically.
