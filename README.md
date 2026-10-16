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
- Authenticated `GET /api/users` for super-admins, `GET /api/users/dashboard` and `PATCH /api/users/students/:id/approve` for admins, and `PATCH`/`DELETE /api/users/:id` for super-admin approval and student/admin account management
- Authenticated `GET`, `POST /api/bookings`, `PATCH /api/bookings/:id/accept`, `POST /api/bookings/:id/messages`; Super Admin-only `GET /api/bookings/records` for saved chat session records
- Super-admin-only `GET`, `POST /api/colleges`

Run backend authentication and dashboard workflow tests with `npm.cmd run test:security --prefix backend`.

The frontend uses server-issued tokens. Counselor assignments, slot requests, chat messages, admin approvals, and college records are stored through the API; the remaining work before publishing includes deployment, Android release setup, real-device testing, and store policy/listing tasks.

## Production API (Render)

The local backend uses SQLite. Production uses PostgreSQL so local development remains unchanged. The Render Blueprint is in `render.yaml`; production Prisma schemas and migrations are under `backend/prisma`. The Blueprint uses a free Render web service and static site, with Neon Free PostgreSQL configured separately.

1. Create a PostgreSQL project on [Neon's Free plan](https://neon.com/pricing) and copy its connection string from the Neon dashboard. Keep this URL private; it contains database credentials.
2. In Render, create a Blueprint from the GitHub repository and review the plans before applying it. The Blueprint does not create a database; it prompts for `DATABASE_URL`.
3. Enter Neon's PostgreSQL connection string as `DATABASE_URL`, plus `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, and a unique `SUPER_ADMIN_PASSWORD`, directly in Render. Do not put these values in source files or chat. Render generates `JWT_SECRET` automatically.
4. Render wires the web service hostname into the API's `CLIENT_ORIGIN` and the API hostname into the static site's `VITE_API_BASE_URL`.
5. Wait for the backend service to report healthy at `/api/health`. Its HTTPS URL plus `/api` is the Android build's `VITE_API_BASE_URL`.

Free-tier services have limits and are intended for testing and hobby projects, not production. Render may spin the API down after 15 minutes of inactivity, so the first request after idle can take about a minute. Its free service filesystem is temporary, which is why production data must use PostgreSQL rather than SQLite. Neon Free has compute, storage, and data-transfer limits and scales to zero; monitor both providers' usage and terms. Do not add a payment method unless you choose to accept possible charges.

The API hashes passwords, issues expiring verifiable tokens, rate-limits authentication, restricts data endpoints by role, and seeds the super-admin from Render environment variables. Existing local plaintext passwords are upgraded to hashes on their next sign-in. Render configuration is preparation only; it does not deploy anything or create service URLs by itself.

The app remembers a successful sign-in across launches using the server-issued session token, not the user's password. Sessions expire after 8 hours; after expiration, sign in again.

For local super-admin access, set `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, and a unique `SUPER_ADMIN_PASSWORD` in `backend/.env`, then run `npm.cmd --prefix backend run db:seed:super-admin`. Never reuse the placeholder values or share real credentials in chat.

## Android

The React/Vite frontend is configured for Capacitor 8. Android builds require Android Studio with Android SDK 36 installed and Java 21 or newer available. If Android Studio hits a Gradle download timeout while fetching the wrapper, the project wrapper is configured with a longer timeout to handle slower networks. The Android sync command requires the deployed API URL so it cannot package a build that points to `localhost`:

```powershell
npm.cmd install --prefix frontend
$env:VITE_API_BASE_URL = "https://your-api.example.com/api"
npm.cmd run android:sync
npm.cmd run android:open
```

Replace the example URL with the actual API base URL, including `/api`. Android blocks cleartext HTTP by default, so use an HTTPS endpoint for development and production. The app currently needs only the Android `INTERNET` permission; do not add sensitive device permissions unless a feature needs them. Android app data backup is disabled by default.

After sync, build and sign the release Android App Bundle from Android Studio. Before publishing, complete real-device tests, publish a privacy policy, and complete Play Console declarations and listing requirements.