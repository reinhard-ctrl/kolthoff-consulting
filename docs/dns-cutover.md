# DNS Cutover Guide — GitHub Pages to Firebase Hosting

## Prerequisites
- Firebase Hosting configured with custom domain in Firebase Console
- All routes verified on Firebase preview channel

## Steps

1. **Parallel run (48h recommended)**
   - Keep GitHub Pages active at `kolthoff-consulting.com`
   - Deploy to Firebase Hosting preview: `firebase hosting:channel:deploy staging`
   - Verify all 17+ routes on staging URL

2. **Add custom domain in Firebase Console**
   - Hosting → Add custom domain → `kolthoff-consulting.com`
   - Firebase provides DNS records (A records or CNAME)

3. **Update DNS**
   - Replace GitHub Pages CNAME with Firebase Hosting records
   - Keep `CNAME` file in repo for reference; Firebase manages SSL

4. **Verify**
   - `/` — marketing site
   - `/workspace/` — workspace SPA
   - `/admin/` — admin SPA
   - `/apps/delivery/project_planner.html` — SOW planner
   - Legacy redirects: `/portal.html` → `/apps/public/portal.html`

5. **Disable GitHub Pages**
   - Repository Settings → Pages → Disable
   - Remove or archive old GitHub Pages deployment

## Staging Environment

Use Firebase preview channels for PR deployments (configured in `.github/workflows/firebase-deploy.yml`).

Optional dedicated staging project: `kolthoff-portal-staging` with subdomain `staging.kolthoff-consulting.com`.
