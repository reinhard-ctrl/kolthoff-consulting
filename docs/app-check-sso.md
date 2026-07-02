# Google Workspace SSO & App Check (Package P5)

## Google Workspace SSO

Staff can sign in with **@kolthoff-consulting.com** Google accounts on:

- **Admin console** (`/admin/`) — primary sign-in; passcode remains break-glass
- **Workspace** (`/workspace/`) — for Kolthoff firm tenant (`kolthoff-admin-app`)

### Firebase Console setup (one-time)

1. [Authentication → Sign-in method](https://console.firebase.google.com/project/kolthoff-portal/authentication/providers)
2. Enable **Google** provider
3. Add authorized domains: `kolthoff-portal.web.app`, `kolthoff-consulting.com`, `www.kolthoff-consulting.com`
4. Deploy Cloud Function `provisionGoogleStaff` (sets custom claims + `core_users`). If CI deploy fails on IAM for a new function, re-run the **Firebase Deploy** workflow on `main` after merge — the workflow sets Cloud Run invoker bindings and retries functions deploy.

### How it works

1. User clicks **Sign in with Google**
2. Firebase Auth validates Google account (hosted domain hint: `kolthoff-consulting.com`)
3. Callable `provisionGoogleStaff` sets `role` + `tenantId` claims and upserts `core_users`
4. Embedded HTML apps inherit the same Auth session and pass `auth-gate.js` via claims

Passcode login still works for break-glass and environments where Google popup is blocked.

---

## App Check + reCAPTCHA v3

App Check protects Firestore, Storage, and Functions from abuse. The codebase bootstraps App Check when a site key is present.

### Setup

1. [Firebase Console → App Check](https://console.firebase.google.com/project/kolthoff-portal/appcheck)
2. Register **reCAPTCHA v3** for the web app
3. Copy the **site key** (public — safe in repo/build env)

### CI / production build

Set GitHub secret or Cloud Build env:

```bash
RECAPTCHA_SITE_KEY=your_recaptcha_v3_site_key
```

The build script injects `window.__RECAPTCHA_SITE_KEY__` into `dist/shared/runtime-config.js` and admin/workspace `index.html`.

Local dev (optional):

```bash
RECAPTCHA_SITE_KEY=... npm run build
```

Debug token for emulators/local (register in Firebase Console → App Check → Manage debug tokens):

```
https://localhost:5000/admin/?appCheckDebug=YOUR_DEBUG_TOKEN
```

### Enforcement rollout

1. **Monitor** — enable App Check in Firebase Console with **Enforcement off**; verify tokens in App Check metrics
2. **Enforce Firestore** — turn on enforcement after staff SSO + client flows verified
3. **Enforce Storage + Functions** — after Firestore stable

Client flows (portal token, intake anonymous, contract sign) continue without App Check until those apps register App Check providers — enforce staff paths first.

---

## Firestore rules hardening (P5)

Staff access now requires one of:

- Kolthoff admin passcode session (`admin_sessions`)
- `@kolthoff-consulting.com` email on the Auth token (Google SSO)
- Valid `tenantId` + non-`portal_client` custom claim (invited workspace users)

Anonymous users can no longer read firm CRM/planner data by merely using email/password without tenant claims.

---

## Related

- `docs/admin-login.md` — passcode troubleshooting
- `docs/security-access.md` — public vs staff apps
- `shared/staff-domain.js` — email domain helper
