# Access control (Phase 1)

## Public (no staff login)

- `/` — marketing site
- `/apps/public/portal.html` — client portal (access code inside app)
- `/apps/public/client_intake.html` — intake form

## Staff hub

- **`/admin/`** — single login (passcode → Firestore session)
- After login, use the sidebar to open admin tools and delivery suite apps

### Admin SPA routes

| Route | Tool |
|-------|------|
| `/admin/` | Operations dashboard |
| `/admin/tenants` | Tenant manager |
| `/admin/intake` | Intake center (forms, templates, sync) |
| `/admin/portals` | Client portal manager |
| `/admin/contracts` | Contract ledger (staff view) |
| `/admin/master` | Master admin console |

Legacy HTML files under `/admin/legacy/` remain deployed for iframe embedding and direct client contract signing links.

## Internal apps (staff gate)

All delivery, operations, analytics, and legacy admin HTML apps import `shared/auth-gate.js`:

- If not signed in as staff → redirect to `/admin/?return=<original-url>`
- After login at `/admin/`, you return to the app you requested

Staff = admin passcode session, Google/email Firebase login, or custom admin/tenant claims.

## Data protection

Firestore rules block **anonymous** reads on firm data (`crm_deals`, `workbook_profiles`, etc.). Even if someone loads HTML, Firestore returns permission denied without a staff session.

## Exceptions

- **Contract ledger client view:** `/admin/legacy/contract_ledger.html?contract=...` (client e-sign links — not redirected)
- **Policy Studio offline:** `window.STANDALONE_POLICIES` bundles

## Phase 3 (planned)

- Google Workspace SSO for `@kolthoff-consulting.com`
- App Check on all apps
- Tighten `core_users` directory reads
- Full React migration of remaining legacy admin tools (portals, contracts, master admin)
