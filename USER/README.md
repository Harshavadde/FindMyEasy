# FindEasy User App

Customer mobile app migrated from `CLIENT/app/(user)` and shared client
services. `CLIENT` remains unchanged as the rollback copy.

Configure `EXPO_PUBLIC_API_URL` in `.env` to the shared FastAPI service. For a
physical device, use a reachable HTTPS or LAN address rather than localhost.

```powershell
npm install
npm run start
npm run typecheck
```

The app uses the existing `/api/v1/auth`, `/api/v1/listings`, and
`/api/v1/favorites` backend APIs.
