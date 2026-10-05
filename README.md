# Neoterik Pathways

## Requirements

- Node.js 22.12.0 or newer
- npm

## Setup

From the project root, install the root runner and backend dependencies:

```powershell
npm.cmd install
npm.cmd install --prefix backend
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

The frontend dependencies are installed separately if needed:

```powershell
npm.cmd install --prefix frontend
```

## Run

Start the API and Vite frontend together:

```powershell
npm.cmd run dev
```

The frontend is served at `http://localhost:5173`; the API is served at `http://localhost:4000`.
The backend creates `backend/prisma/dev.db` from the Prisma schema on first start.

To run only the backend, use `npm.cmd run dev:backend`. Check it at
`http://localhost:4000/api/health`.

## API

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET`, `PATCH /api/auth/profile`
- Authenticated `GET /api/users` for super-admins, `GET /api/users/dashboard` and `PATCH /api/users/students/:id/approve` for admins, `PATCH /api/users/:id` for super-admin approval
- Authenticated `GET`, `POST /api/bookings`, `PATCH /api/bookings/:id/accept`, `POST /api/bookings/:id/messages`
- Super-admin-only `GET`, `POST /api/colleges`

Run backend authentication and dashboard workflow tests with `npm.cmd run test:security --prefix backend`.

The frontend uses server-issued tokens. Counselor assignments, slot requests, chat messages, admin approvals, and college records are stored through the API; the remaining work before publishing includes deployment, Android release setup, real-device testing, and store policy/listing tasks.

## Production API (Render)

The local backend uses SQLite. Production is configured separately to use PostgreSQL so local development remains unchanged. The Render Blueprint is in `render.yaml`; production Prisma schemas and migrations are under `backend/prisma`.

1. Put the project in a GitHub repository and connect it to a Render account.
2. In Render, create a Blueprint from that repository and review the service/database plans and pricing before applying it. This blueprint provisions web and database resources.
3. Render wires the web service hostname into the API's `CLIENT_ORIGIN` and the API hostname into the web service's `VITE_API_BASE_URL`.
4. Enter `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, and a unique `SUPER_ADMIN_PASSWORD` directly into Render when prompted. Do not put these values in source files or chat. Render generates `JWT_SECRET` automatically.
5. Wait for the backend service to report healthy at `/api/health`. Its HTTPS URL plus `/api` is the Android build's `VITE_API_BASE_URL`.

The API hashes passwords, issues expiring verifiable tokens, rate-limits authentication, restricts data endpoints by role, and seeds the super-admin from Render environment variables. Existing local plaintext passwords are upgraded to hashes on their next sign-in. Render configuration is preparation only; it does not deploy anything or create service URLs by itself.

For local super-admin access, set `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, and a unique `SUPER_ADMIN_PASSWORD` in `backend/.env`, then run `npm.cmd --prefix backend run db:seed:super-admin`. Never reuse the placeholder values or share real credentials in chat.

## Android

The React/Vite frontend is configured for Capacitor 8. Android builds require Android Studio with Android SDK 36 installed and Java 21 or newer available. The Android sync command requires the deployed API URL so it cannot package a build that points to `localhost`:

```powershell
npm.cmd install --prefix frontend
$env:VITE_API_BASE_URL = "https://your-api.example.com/api"
npm.cmd run android:sync
npm.cmd run android:open
```

Replace the example URL with the actual API base URL, including `/api`. Android blocks cleartext HTTP by default, so use an HTTPS endpoint for development and production. The app currently needs only the Android `INTERNET` permission; do not add sensitive device permissions unless a feature needs them. Android app data backup is disabled by default.

After sync, build and sign the release Android App Bundle from Android Studio. Before publishing, complete real-device tests, publish a privacy policy, and complete Play Console declarations and listing requirements.