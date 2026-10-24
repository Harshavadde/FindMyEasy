# FindEasy client setup

## Use the same account and listings on multiple devices

Accounts and property listings are stored by the FastAPI server, not on the
device. Every device must connect to the same running server, and that server
must use the same PostgreSQL database. If each PC runs its own backend, an
account created on one PC will not exist on the other, and listings will not
be shared.

1. Choose one shared backend reachable by both PCs, or deploy the backend
   behind an HTTPS URL. It must use the same PostgreSQL database for both
   devices.
2. In this `CLIENT` folder, create `.env` from `.env.example` and set
   `EXPO_PUBLIC_API_URL` to the shared backend's base URL. For example, when
   both PCs are on the same LAN:
   `EXPO_PUBLIC_API_URL=http://192.168.1.25:8000`
3. Set the same URL in the client configuration on every PC. Do not use each
   PC's own Expo/Metro host address as the backend URL.
4. Ensure the backend is reachable from both PCs, including network and
   Windows Firewall access. Restart Expo after changing `.env`, for example
   with `npx expo start -c`.

The automatic Expo-host fallback is convenient for a single-PC development
setup, but it can connect different PCs to different databases. Existing
accounts and listings on separate databases are not merged automatically;
move the required data into the shared database before using the shared
server.
