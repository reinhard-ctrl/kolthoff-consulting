# Project completion checklist

Finish the Kolthoff Firebase migration. Code is deployed to **https://kolthoff-portal.web.app** — complete these steps to go live on **kolthoff-consulting.com**.

---

## Your action items (required)

### 1. Firebase Authentication (Console)

Open [Firebase Authentication](https://console.firebase.google.com/project/kolthoff-portal/authentication/providers):

| Provider | Action |
|----------|--------|
| **Anonymous** | Enable (admin passcode flow) |
| **Email/Password** | Enable (workspace team login) |

### 2. Admin passcode (Firestore)

Create document:

- **Path:** `artifacts/kolthoff-admin-app/public/data/admin_credentials/kolthoff2026`
- **Field:** `role` = `kolthoff_admin`

Or in [Cloud Shell](https://shell.cloud.google.com/?project=kolthoff-portal):

```bash
bash scripts/seed-admin-passcode.sh kolthoff2026
```

### 3. API key HTTP referrers (Google Cloud)

[Credentials → Browser key](https://console.cloud.google.com/apis/credentials?project=kolthoff-portal) (`AIzaSyDtWOj19Pw0n7NGo4JQZ7sbLcazu_XZzNI`):

```
https://kolthoff-portal.web.app/*
https://kolthoff-consulting.com/*
https://www.kolthoff-consulting.com/*
```

### 4. Verify on Firebase URL

After steps 1–3, hard-refresh and test:

| Test | URL |
|------|-----|
| Admin login | https://kolthoff-portal.web.app/admin/ |
| CRM (redirects to admin if not signed in) | https://kolthoff-portal.web.app/apps/operations/crm_pipeline.html |
| Planner | https://kolthoff-portal.web.app/apps/delivery/project_planner.html |
| Workspace | https://kolthoff-portal.web.app/workspace/ |
| Client portal (public) | https://kolthoff-portal.web.app/apps/public/portal.html |
| Marketing (public) | https://kolthoff-portal.web.app/ |

---

## Phase 2 — Load production data

After Phase 1 auth works, seed Firestore in [Cloud Shell](https://shell.cloud.google.com/?project=kolthoff-portal):

```bash
bash scripts/seed-production-data.sh --dry-run
bash scripts/seed-production-data.sh
```

This loads CRM deals/contacts/partners, feature flags, and org departments. Then:

| Task | How |
|------|-----|
| SOW profiles | Project Planner UI, or edit `scripts/seed-firestore/data/workbook_profiles.json` |
| Client portals | Admin Console → Import Profile, or edit `clients.json` |
| Team invites | `/admin/` → Tenant Manager → Invite User |
| Google Drive links | Add `assets[].gDriveLink` on each `clients` doc manually |

Full guide: **`docs/data-seeding.md`**

---

### 5. DNS cutover (Squarespace)

In [Firebase Hosting → Custom domains](https://console.firebase.google.com/project/kolthoff-portal/hosting/sites), add `kolthoff-consulting.com` and `www.kolthoff-consulting.com`.

**Remove (GitHub Pages):**
- A `@` → `185.199.108.153` (and .109, .110, .111)
- CNAME `www` → `reinhard-ctrl.github.io`

**Add (Firebase):**
- A `@` → `199.36.158.100`
- TXT `@` → `hosting-site=kolthoff-portal`
- CNAME `www` → value shown in Firebase wizard

**Keep:** MX `@` → `smtp.google.com` (Google email)

See `docs/dns-cutover.md` for full detail.

### 6. Disable GitHub Pages

After custom domain works: GitHub repo → Settings → Pages → **Disable**.

---

## Already done in code

- Firebase Hosting + 17 apps + workspace/admin SPAs
- CI/CD deploy on push to `main`
- Staff auth gate on internal HTML apps
- Firestore rules block anonymous CRM/planner reads
- CRM unified on `crm_deals` collection
- Legacy URL redirects (`/crm_pipeline.html`, etc.)
- Workspace: password required; admin passcode session auto-access
- Tenant Manager invites via `inviteWorkspaceUser` Cloud Function
- Single login: legacy HTML apps rely on `shared/auth-gate.js` (no second passcode screen)
- Admin legacy HTML migrated to React SPA (`/admin/portals`, `/admin/contracts`, `/admin/intake`, `/admin/master`)
- Phase 2 seed tooling: `scripts/seed-firestore/` + `scripts/seed-production-data.sh`
- Client-side demo auto-seed disabled (`KOLTHOFF_DISABLE_CLIENT_SEED`)

---

## After go-live (roadmap)

- Google Workspace SSO (`@kolthoff-consulting.com`)
- App Check + reCAPTCHA
- Master Admin blueprint visual designer
- Migrate delivery/ops/analytics HTML apps into React
- Portal custom-token auth (replace anonymous client access)

---

## Support docs

- `docs/admin-login.md` — passcode troubleshooting
- `docs/security-access.md` — public vs staff apps
- `docs/data-seeding.md` — Phase 2 production data load
- `docs/data-model.md` — Firestore collections
- `docs/dns-cutover.md` — DNS migration steps
