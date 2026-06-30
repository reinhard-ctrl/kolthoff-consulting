# DNS Cutover Guide — GitHub Pages to Firebase Hosting

## Prerequisites
- Firebase Hosting configured with custom domain in Firebase Console
- All routes verified on https://kolthoff-portal.web.app
- Complete `docs/project-completion.md` steps 1–4 first

## Squarespace DNS (kolthoff-consulting.com)

### 1. Add custom domain in Firebase
- [Firebase Console → Hosting](https://console.firebase.google.com/project/kolthoff-portal/hosting/sites)
- Add `kolthoff-consulting.com` and `www.kolthoff-consulting.com`
- Copy the DNS records Firebase shows

### 2. Update Squarespace DNS

**Remove (old GitHub Pages):**
| Type | Host | Old value |
|------|------|-----------|
| A | `@` | `185.199.108.153`, `.109`, `.110`, `.111` |
| CNAME | `www` | `reinhard-ctrl.github.io` |

**Add (Firebase Hosting):**
| Type | Host | Value |
|------|------|-------|
| A | `@` | `199.36.158.100` |
| TXT | `@` | `hosting-site=kolthoff-portal` |
| CNAME | `www` | *(from Firebase wizard)* |

**Keep unchanged:**
| Type | Host | Value |
|------|------|-------|
| MX | `@` | `smtp.google.com` (Google Workspace email) |

### 3. Wait for propagation
DNS can take up to 48 hours. Firebase Console will show **Connected** when verified.

### 4. Verify routes on custom domain

- `/` — marketing site
- `/admin/` — admin console
- `/workspace/` — team portal
- `/apps/delivery/project_planner.html` — SOW planner
- `/apps/operations/crm_pipeline.html` — CRM
- `/apps/public/portal.html` — client portal
- Legacy redirects: `/portal.html`, `/crm_pipeline.html`, `/admin_console.html`

### 5. Disable GitHub Pages
- GitHub repo → Settings → Pages → Disable
- Optionally remove root `CNAME` file from repo after cutover

## Staging

PR preview channels deploy automatically via GitHub Actions (`.github/workflows/firebase-deploy.yml`).

Optional: dedicated project `kolthoff-portal-staging` at `staging.kolthoff-consulting.com`.
