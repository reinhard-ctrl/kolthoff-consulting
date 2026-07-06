# Agency Ops Starter

White-label **quote-to-cash** product for small PH agencies, shipped as a separate admin shell with its own demo tenant.

## URLs

| Environment | URL |
|-------------|-----|
| **Demo console** | `https://kolthoff-consulting.com/agency-ops/` |
| **Firebase default** | `https://kolthoff-portal.web.app/agency-ops/` |
| **Kolthoff full OS** | `/admin/` (unchanged) |

## Demo login

| Field | Value |
|-------|-------|
| Passcode | `demostart2026` |
| Tenant ID | `agency-ops-demo` |

Google SSO is hidden on the demo shell — passcode only.

## What's included (Starter tier)

- **CRM Pipeline** — sales pipeline with deal values
- **Estimates** — simplified planner (Estimate → Documents → Invoice tabs)
- **Collections** — invoices, partial payments, overdue tracking

Hidden vs full Kolthoff OS: Delivery Suite, Analytics, Workspace Admin, Portals, Contracts.

## Seed demo data

From Cloud Shell (project `kolthoff-portal`):

```bash
bash scripts/seed-agency-ops-demo.sh
# Force overwrite:
bash scripts/seed-agency-ops-demo.sh agency-ops-demo --force
```

Or manually:

```bash
cd scripts/seed-firestore && npm install
node seed.mjs --tenant agency-ops-demo --data-dir agency-ops --force
```

Seed pack lives in `scripts/seed-firestore/data/agency-ops/`.

## Local development

```bash
cd admin
npm install
npm run dev:agency-ops
```

Open `http://localhost:5173/agency-ops.html` (Vite dev).

## Production build

The root build script builds both shells:

```bash
node scripts/build.js
# Outputs: dist/admin/ and dist/agency-ops/
```

## Architecture

| Piece | Location |
|-------|----------|
| Product config (React) | `admin/src/lib/product-config.ts` |
| Product config (HTML apps) | `shared/product-config.js` |
| Starter nav | `AGENCY_OPS_STARTER_NAV` in product-config.ts |
| Demo dashboard | `admin/src/pages/AgencyOpsDashboard.tsx` |
| Demo seed data | `scripts/seed-firestore/data/agency-ops/` |
| Vite entry | `admin/agency-ops.html` |

Each product build sets `VITE_PRODUCT_ID`:

- `kolthoff-os` → `/admin/` → tenant `kolthoff-admin-app`
- `agency-ops-starter` → `/agency-ops/` → tenant `agency-ops-demo`

Embedded HTML apps receive `?product=agency-ops-starter&tenant=agency-ops-demo` via the admin iframe.

## Provisioning a new client

1. Create a new tenant ID (e.g. `client-pixel-wave`)
2. Copy and customize seed data from `data/agency-ops/`
3. Run `node seed.mjs --tenant client-pixel-wave --data-dir agency-ops --force`
4. Update `tenant_settings/config` branding fields
5. Create `admin_credentials/{passcode}` for client login

Future: automate via **Agency Ops Manager** in Kolthoff OS (`/admin/agency-ops-manager`) or the **Provision Agency Ops** action on signed PRO contracts in Contract Ledger.

**Provisioning path:** Admin UI writes to `agency_ops_provision_requests` → Firestore trigger `processAgencyOpsProvisionRequest` (no public Cloud Function required). Callable `prepareAgencyOpsTenant` remains as fallback where public invoke is allowed.

**Phase 3 (live):** PRO 1 contracts auto-provision on e-sign via the `onContractLedgerWritten` Firestore trigger. Passcodes are stored on the tenant registry (`initialPasscode`) for staff retrieval. Paid clients use `/agency-ops/?tenant=agency-{slug}` — the tenant ID persists in session storage across reloads.
