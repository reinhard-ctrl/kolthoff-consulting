# Phase 2 — Production data loading

Load real business data into Firestore after Phase 1 (auth + passcode) is complete. Run these steps in [Google Cloud Shell](https://shell.cloud.google.com/?project=kolthoff-portal) or any environment with `gcloud`/`firebase` access to project `kolthoff-portal`.

---

## Quick start

```bash
# 1. Admin passcode (if not done in Phase 1)
bash scripts/seed-admin-passcode.sh kolthoff2026

# 2. Load CRM, feature flags, org structure
bash scripts/seed-production-data.sh --dry-run   # preview
bash scripts/seed-production-data.sh             # apply
```

This is **idempotent** — existing documents are skipped unless you pass `--force`.

---

## What gets seeded

| Collection | Source file | Included by default |
|------------|-------------|---------------------|
| `crm_deals` | `scripts/seed-firestore/data/crm_deals.json` | Yes (8 deals) |
| `crm_contacts` | `crm_contacts.json` | Yes (5 contacts) |
| `crm_partners` | `crm_partners.json` | Yes (3 partners) |
| `tenant_settings` | `tenant_settings.json` | Yes — doc `config`, all features ON |
| `core_departments` | `core_departments.json` | Yes (3 departments) |
| `workbook_profiles` | `workbook_profiles.json` | Empty — add your SOWs |
| `clients` | `clients.json` | Empty — add portal records |

All paths: `artifacts/kolthoff-admin-app/public/data/{collection}/{docId}`

---

## Load order (dependencies)

```
1. admin_credentials          ← Phase 1 (seed-admin-passcode.sh)
2. tenant_settings/config     ← feature flags
3. core_departments           ← before workspace users
4. workbook_profiles          ← SOW planner data
5. crm_deals (+ contacts/partners)
6. clients                    ← portal access codes; link via sowReference / quoteId
7. contracts_ledger           ← created when contracts are sent/signed
8. core_users                 ← via Tenant Manager invites (Firebase Auth)
```

---

## Workbook profiles (SOW planner)

The seed repo ships an **empty** `workbook_profiles.json`. Add your SOW data:

**Option A — Edit JSON and re-seed**

1. Copy profile objects into `scripts/seed-firestore/data/workbook_profiles.json`
2. Each object needs `"id"` (slug, e.g. `gts-2026`) plus planner fields (`clientCompany`, `quoteId`, `tasks`, etc.)
3. Run: `bash scripts/seed-production-data.sh --only workbook_profiles`

**Option B — Create in the app**

1. Log in at `/admin/`
2. Open [Project Planner](https://kolthoff-portal.web.app/apps/delivery/project_planner.html)
3. Build each SOW — data saves to Firestore automatically

Client-side demo auto-seed is **disabled** in production (`KOLTHOFF_DISABLE_CLIENT_SEED`), so empty collections stay empty until you seed or create data manually.

---

## Client portals

Portal access code = Firestore document ID under `clients`.

**Option A — Admin Console import**

1. Open `/admin/portals` (after admin login)
2. Use **Import Profile** dropdown to create a portal from an existing SOW

**Option B — Seed JSON**

Add records to `scripts/seed-firestore/data/clients.json` and run:

```bash
bash scripts/seed-production-data.sh --only clients
```

**Google Drive vault links** — add manually to each client doc under `assets[]`:

```json
{ "title": "SOW PDF", "category": "MOD 1", "type": "pdf", "gDriveLink": "https://drive.google.com/..." }
```

There is no Google Drive API migration; links are stored as URL strings.

---

## Workspace team invites

Firestore `core_users` requires matching Firebase Auth accounts. Use the Admin SPA:

1. Log in at `/admin/`
2. Open **Tenant Manager**
3. Ensure **Email/Password** auth is enabled in Firebase Console
4. Enter name + email → **Invite User**

This calls the `inviteWorkspaceUser` Cloud Function (creates Auth user + `core_users` doc + custom claims).

Invite `@kolthoff-consulting.com` addresses once Google Workspace SSO is configured (post-go-live roadmap).

---

## Feature flags

Default production config (seeded to `tenant_settings/config`):

| Flag | Value |
|------|-------|
| `messenger` | ON |
| `approvals` | ON |
| `vault` | ON |
| `crm` | ON |

Toggle live at `/admin/` → Tenant Manager, or edit `tenant_settings.json` and re-seed with `--force`.

---

## Advanced options

```bash
cd scripts/seed-firestore
npm install

# Specific tenant
node seed.mjs --tenant client-acme-corp

# Specific collections only
node seed.mjs --only crm_deals,crm_contacts,crm_partners

# Overwrite existing documents
node seed.mjs --force

# Dry run
node seed.mjs --dry-run
```

---

## Verify after seeding

| Check | How |
|-------|-----|
| CRM deals | `/apps/operations/crm_pipeline.html` — board shows 8 deals |
| Feature flags | `/admin/` → Tenant Manager — CRM/Vault toggles ON |
| Planner | `/apps/delivery/project_planner.html` — profiles from Firestore |
| Workspace | `/workspace/` — invite a user, confirm login |
| Portal | `/apps/public/portal.html` — enter client access code |

Run `bash scripts/smoke-test.sh` for HTTP checks.

---

## Related docs

- `docs/data-model.md` — collection reference
- `docs/project-completion.md` — full go-live checklist
- `scripts/seed-firestore/data/README.md` — JSON file format
