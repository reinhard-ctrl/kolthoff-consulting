# Kolthoff Consulting — Operations Suite

Unified Firebase platform for client delivery, workspace, and internal operations.

## Structure

```
apps/public/       Marketing site, client portal, intake forms
apps/delivery/     SOW planner, Leak Scan Report (diagnosis reports)
apps/operations/   CRM, policy studio, workflow builder
apps/analytics/    Firm analytics, capacity, time tracking
admin/             Unified admin Vite SPA (all admin tools in React)
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

See [docs/project-completion.md](docs/project-completion.md) for the final go-live checklist.
