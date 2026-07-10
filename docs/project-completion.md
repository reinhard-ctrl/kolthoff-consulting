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
http://localhost/*
http://127.0.0.1/*
http://localhost:5000/*
http://127.0.0.1:5000/*
```

Local dev: `npm run serve:hosting` then open http://localhost:5000/apps/delivery/project_planner.html

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
# One command — auto-clones repo if needed:
curl -sL https://raw.githubusercontent.com/reinhard-ctrl/kolthoff-consulting/main/scripts/go-live-cloudshell.sh | bash

# Or from a clone:
git clone https://github.com/reinhard-ctrl/kolthoff-consulting.git
cd kolthoff-consulting
bash scripts/go-live-cloudshell.sh

# Verify after seed:
bash scripts/verify-go-live.sh
```

This loads CRM deals/contacts/partners, feature flags, and org departments. Then:

| Task | How |
|------|-----|
| SOW profiles | Project Planner UI, or edit `scripts/seed-firestore/data/workbook_profiles.json` |
| Client portals | `/admin/portals` → Import SOW, or edit `clients.json` |
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

### Go-live complete (confirmed)

- Custom domain `kolthoff-consulting.com` on Firebase Hosting
- Live production data in Firestore
- GitHub Pages retired

---

## After go-live — see full roadmap

**Platform roadmap (stable · fast · optimized):** [`docs/migration-roadmap.md`](migration-roadmap.md)

North star: P4 ✅ verified on production (6 Jul 2026). **Mod 1 delivery tooling ✅ closed and deployed** (7 Jul 2026, #242). Optional eng: App Check (P5), React migration (P6). **Your focus:** **Phase 4 content** (SOWs, playbooks, portal defaults), live Mod 1→Mod 2 engagements, and first PRO 1 client handoff.

| Phase | Focus | Status |
|-------|--------|--------|
| **2.5** | Ops hardening — portal auth, workspace, embeds, CRM sync | ✅ **Complete** — P4 verified |
| **3** | SSO, workspace provision, Agency Ops PRO, onboard wizard | ✅ **Eng complete** — App Check + P6 optional |
| **4** | Content, templates, delivery automation (**your focus**) | 🔶 **Active** |
| **5** | Idol figure — demo tenant, metrics, case studies | Ongoing |

Recent stability fixes (Jul 2026): workspace deploy (#146), admin embed auth (#152), Agency Ops Firestore provisioning (#165–#217), SSO cold-start (#175–176), P4 verified (#213–#216), direct workspace provision (#217), **Mod 1 Leak Scan Report closed** (#242, deployed 7 Jul 2026).

---

## Support docs

- `docs/admin-login.md` — passcode troubleshooting
- `docs/security-access.md` — public vs staff apps
- `docs/data-seeding.md` — Phase 2 production data load
- `docs/data-model.md` — Firestore collections
- `docs/dns-cutover.md` — DNS migration steps
