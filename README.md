# Kolthoff Consulting — Operations Suite

Unified Firebase platform for client delivery, workspace, and internal operations.

## Structure

```
apps/public/       Marketing site, client portal, intake forms
apps/delivery/     SOW planner, diagnosis reports
apps/operations/   CRM, policy studio, workflow builder
apps/analytics/    Firm analytics, capacity, time tracking
admin/             Unified admin Vite SPA (dashboard, intake, embedded legacy tools)
admin/legacy/      Legacy HTML tools embedded in SPA routes (portals, contracts, master)
workspace/         Core workspace Vite SPA
shared/            Firebase init, financials, auth helpers
functions/         Cloud Functions (auth, validation)
```

## Quick Start

```bash
npm install
npm run build
firebase emulators:start
```

## Deploy

```bash
npm run deploy
```

Production domain: `kolthoff-consulting.com` via Firebase Hosting.

See [docs/data-model.md](docs/data-model.md) for Firestore schema, [docs/admin-login.md](docs/admin-login.md) for admin login, and [docs/security-access.md](docs/security-access.md) for public vs staff apps.
