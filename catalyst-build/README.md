# FindEasy FastAPI AppSail deployment

This directory is a clean deployment copy of the FindEasy backend. Source changes should be made in `../SERVER`, then refreshed into this directory before deployment.

## Runtime

- Catalyst stack: Python 3.13
- Local fallback port: 9000
- Bind address: 0.0.0.0
- Startup command: `python3 run.py`
- FastAPI entry point: `app.main:app` (launched by `run.py`)

AppSail supplies the listen port through `X_ZOHO_CATALYST_LISTEN_PORT`.
`run.py` defaults to port 9000 when the variable is absent.

## Configure environment variables

Copy `.env.example` locally and set real values in Catalyst environment settings. Never commit secrets.

Required:

- `DATABASE_URL`: PostgreSQL connection URL.
- `AUTH_SECRET_KEY`: long random secret used to sign JWTs.
- `PUBLIC_BASE_URL`: public AppSail HTTPS base URL.

Recommended storage settings:

- `AWS_ENDPOINT_URL_S3`
- `NEON_STORAGE_BUCKET`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

For production, configure `CORS_ORIGINS` as a comma-separated allowlist containing only required HTTPS/mobile-web origins. Native clients do not rely on browser CORS.

## Local validation

Create a clean environment outside the deployed directory:

```powershell
python -m venv .appsail-venv
.\.appsail-venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r catalyst-build\requirements.txt
```

Compile source:

```powershell
python -m compileall -q catalyst-build\app catalyst-build\migrate.py
```

Run migrations against a prepared PostgreSQL database:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
$env:AUTH_SECRET_KEY="local-development-secret"
python catalyst-build\migrate.py
```

This migration adds the nullable `listings.owner_id` column if missing, creates
its index, and adds a `NOT VALID` foreign key to `users.id`. It does not delete,
rewrite, or automatically associate existing listings. Legacy listings with
missing or unverified ownership must be reviewed and associated only after
their legitimate owner is confirmed. Review existing non-null owner IDs before
the migration; it stops before adding the constraint if any non-null owner ID
does not reference a user. It does not run `VALIDATE CONSTRAINT`.

Start locally with the configured AppSail command:

```powershell
$env:X_ZOHO_CATALYST_LISTEN_PORT="9000"
python3 run.py
```

Test:

```text
http://localhost:9000/health
http://localhost:9000/docs
```

## Catalyst deployment

Run from the existing Catalyst project root that contains `catalyst.json`
(`d:\FindEasy\catalyst-build` in this checkout):

```powershell
catalyst -p 89855000000016028 deploy appsail
```

The explicit project ID prevents deploying to a different project. The
`catalyst.json` manifest selects the existing `FindEasy-api` AppSail service.
This command deploys to Catalyst's Development environment; confirm that is
the intended environment before running it. Configure all required
environment variables in Catalyst before deploying or starting the service.

## Database migration safety

`migrate.py` creates missing tables, applies the existing `users.phone` column
change, and adds the nullable listing owner column, index, and foreign key if
needed. It does not drop, truncate, rewrite, or assign existing listing rows.
Listings without a verified owner remain unassigned for manual review.

Run migrations before the first production deployment or after schema changes:

```powershell
python migrate.py
```

To roll back the owner constraint and index while preserving the owner column
and any verified associations:

```powershell
python migrate.py --rollback-owner-relationship
```

The owner column is deliberately retained on rollback because dropping it could
erase ownership assignments. The rollback does not undo the existing users
phone-column change or tables created by `create_all()`.

## Image storage

Listing and Aadhaar member files use external object storage when configured by the S3 variables above. AppSail instance filesystems should not be treated as durable storage. Aadhaar files and private member documents must remain protected and are not public API assets.
