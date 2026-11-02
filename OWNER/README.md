# FindEasy Owner App

Property management mobile app migrated from `CLIENT/app/(owner)` and shared
client services. `CLIENT` remains unchanged as the rollback copy.

Configure `EXPO_PUBLIC_API_URL` in `.env` to the same FastAPI service used by
the User app. For a physical device, use a reachable HTTPS or LAN address.

```powershell
npm install
npm run start
npm run typecheck
```

This phase preserves existing owner registration and API permissions. The
separate partner application/invitation workflow is intentionally not included.
