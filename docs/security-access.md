# Access control

## Public (no staff login)

- `/` — marketing site
- `/apps/public/portal.html` — client portal (access code inside app)
- `/apps/public/client_intake.html` — intake form
- `/apps/public/contract_sign.html?contract=...` — client e-signature (no staff login)
- `/apps/public/crm_pipeline_view.html?token=...` — read-only CRM pipeline share (no staff login)

## Staff hub

- **`/admin/`** — sign in with **Google Workspace** (`@kolthoff-consulting.com`) or break-glass **passcode**
- After login, use the sidebar to open admin tools and delivery suite apps

### Admin SPA routes

| Route | Tool |
|-------|------|
| `/admin/` | Operations dashboard |
| `/admin/tenants` | Tenant manager |
| `/admin/intake` | Intake center |
| `/admin/portals` | Client portal manager |
| `/admin/contracts` | Contract ledger (staff) |
| `/admin/master` | Master admin (tickets, blueprints) |

## Internal apps (staff gate)

Delivery, operations, and analytics HTML apps import `shared/auth-gate.js`:

- If not signed in as staff → redirect to `/admin/?return=<original-url>`

## Exceptions

- **Policy Studio offline:** `window.STANDALONE_POLICIES` bundles

## Planned

- ~~Google Workspace SSO for `@kolthoff-consulting.com`~~ — see **`docs/app-check-sso.md`**
- App Check enforcement in Firebase Console (site key wired in build)
