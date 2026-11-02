# FindEasy Admin

Independent Next.js internal admin site. It uses the existing FastAPI service
and database; API calls are proxied by Next.js to avoid browser CORS setup.

Copy `.env.example` to `.env.local` and set `FINDEASY_API_ORIGIN` to the shared
FastAPI origin.

```powershell
npm install
npm run dev
npm run typecheck
npm run build
```

Open `http://localhost:3000/login?role=admin`. Admin accounts must already be
provisioned through the trusted backend/database process. This application
does not provide public admin registration.

The Admin Console includes Listing Review and Initial Request Review. Admins
can review applications, record approval/rejection/additional-information
decisions, and create, inspect, or revoke Owner invitations. These actions use
the authenticated FastAPI Admin endpoints. The Listing Review module remains
separate.

Before deploying the review workflow, review and manually apply
[`SERVER/migrations/owner_application_review_workflow.sql`](../SERVER/migrations/owner_application_review_workflow.sql)
to the configured database. The application does not run this migration.
Invitations are stored as token hashes, expire after 72 hours by default, and
are not sent automatically; the link is returned to the Admin once for copying.
The CLIENT registration route is Phase 5 work, so do not distribute generated
links until that route is deployed.
