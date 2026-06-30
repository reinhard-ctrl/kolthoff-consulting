# Access control (Phase 1)

## Public (no staff login)

- `/` — marketing site
- `/apps/public/portal.html` — client portal (access code inside app)
- `/apps/public/client_intake.html` — intake form

## Staff hub

- **`/admin/`** — single login (passcode → Firestore session)
- After login, open tools from the sidebar or `/admin/legacy/index.html`

## Internal apps (staff gate)

All delivery, operations, analytics, and legacy admin HTML apps import `shared/auth-gate.js`:

- If not signed in as staff → redirect to `/admin/?return=<original-url>`
- After login at `/admin/`, you return to the app you requested

Staff = admin passcode session, Google/email Firebase login, or custom admin/tenant claims.

## Data protection

Firestore rules block **anonymous** reads on firm data (`crm_deals`, `workbook_profiles`, etc.). Even if someone loads HTML, Firestore returns permission denied without a staff session.

## Exceptions

- **Contract ledger client view:** `contract_ledger.html?contract=...` (client links)
- **Policy Studio offline:** `window.STANDALONE_POLICIES` bundles

## Phase 2 (planned)

- Google Workspace SSO for `@kolthoff-consulting.com`
- App Check on all apps
- Tighten `core_users` directory reads
- Migrate HTML tools into authenticated Admin SPA routes
