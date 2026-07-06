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

## Provisioning a new client (PRO 1)

**Recommended — automated in Kolthoff OS:**

1. CRM → tag deal as **product** (PRO 1 · Agency Ops)
2. Planner → apply **Agency Ops Starter** package → generate contract
3. Client signs → auto-provision on e-sign (`onContractLedgerWritten`)
4. **Agency Ops Manager** (`/admin/agency-ops-manager`) → verify tenant **ready**, copy handoff
5. Select tenant in **Active Agency Ops tenant** → sidebar **Agency Ops** opens client console for support
6. Client: passcode → branding → first deal (empty planner by design)

**Manual / retry:** Agency Ops Manager **Provision now** or **Retry provision** (instant direct Firestore path). Contract Ledger shows status + console link.

**Passcode ops:** Copy from registry; **Reset passcode** rotates credentials (staff-only).

**Cancel / delete:** **Cancel account** soft-disables access; **Delete** removes test tenants from registry (typed confirm).

Console URL: `https://kolthoff-consulting.com/agency-ops/?tenant=agency-{slug}`

**Technical path:** Staff provision uses direct Firestore writes (`provisionAgencyOpsDirect`) when rules allow; auto-provision on sign queues `agency_ops_provision_requests` → `processAgencyOpsProvisionRequest`. Callable `prepareAgencyOpsTenant` remains for ops where public invoke is allowed.

Do **not** use `agency-ops-demo` or `demostart2026` for sold clients.

## Demo seed only (sales sandbox)

For the public demo tenant (`agency-ops-demo`) only:

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

Paid client tenants are **not** seeded — they start empty (see provisioning above).
