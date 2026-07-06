# Admin login troubleshooting

Admin passcode login uses **Firestore directly** (no public Cloud Function required). This works when your GCP organization policy blocks granting `allUsers` the Cloud Run invoker role.

## Normal flow

### Google Workspace (recommended)

1. Open https://kolthoff-consulting.com/admin/
2. Click **Sign in with Google** using your `@kolthoff-consulting.com` account (full-page redirect — no popup).
3. The app provisions staff via Firestore (`staff_sso_requests`) — no public Cloud Function required. See **`docs/app-check-sso.md`**.

### Passcode (break-glass)

1. Open https://kolthoff-portal.web.app/admin/ (or https://kolthoff-consulting.com/admin/ after DNS cutover).
2. The app signs in anonymously, then checks your passcode against Firestore at  
   `artifacts/kolthoff-admin-app/public/data/admin_credentials/{PASSCODE}`.
3. On success it creates an `admin_sessions/{uid}` document so Firestore rules grant admin access.

## Prerequisites

### Firestore passcode document

Create in Firebase Console → Firestore, **or** run in [Cloud Shell](https://shell.cloud.google.com/?project=kolthoff-portal):

```bash
bash scripts/seed-admin-passcode.sh kolthoff2026
```

Manual path in Firestore:

- Path: `artifacts/kolthoff-admin-app/public/data/admin_credentials/kolthoff2026`
- Document ID: your passcode (case-sensitive in Firestore; the app tries upper/lower variants)
- Field: `role` = `kolthoff_admin`

### Firebase Auth

Enable **Anonymous** and **Google** sign-in in Firebase Console → Authentication → Sign-in method.

### API key HTTP referrers

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials?project=kolthoff-portal), edit the **Browser key** and add:

- `https://kolthoff-portal.web.app/*`
- `https://kolthoff-consulting.com/*`
- `https://www.kolthoff-consulting.com/*`
- `http://localhost/*`
- `http://127.0.0.1/*`
- `http://localhost:5000/*` (Firebase hosting emulator — `npm run serve:hosting`)
- `http://127.0.0.1:5000/*`

Browser key prefix: `AIzaSyDtWOj19Pw0n7NGo4JQZ7sbLcazu_XZzNI`

## Common errors

| Symptom | Fix |
|--------|-----|
| `auth/requests-from-referer-blocked` | Add site URL to API key HTTP referrers (above) |
| `auth/requests-from-referer-null-are-blocked` | Do not open HTML via `file://`. Use https://kolthoff-portal.web.app/... or `npm run serve:hosting` → http://localhost:5000/... |
| `Invalid passcode` | Create the Firestore credentials doc; passcode is case-insensitive |
| `permission-denied` | Deploy latest Firestore rules; enable Anonymous auth |
| Stuck on "Loading..." | Anonymous auth blocked — check referrers and Auth settings |
| Black screen after login | Redeploy latest admin build — a bad deploy used `doc()` for collection paths and React crashed silently |
| Blank page, no UI at all | Check browser console for JS 404s; ensure `/admin/assets/*.js` loads (rebuild with `npm run build`) |

## Optional: Cloud Function path (org policy must allow public invoke)

Legacy callable `verifyAdminPasscode` and HTTP `verifyAdminPasscodeHttp` require **public** Cloud Run access. Firebase Hosting rewrites also require public invoke. If your org policy allows `allUsers`, run in [Google Cloud Shell](https://shell.cloud.google.com/?project=kolthoff-portal):

```bash
PROJECT=kolthoff-portal
REGION=asia-southeast1

for FN in verifyAdminPasscode verifyAdminPasscodeHttp generatePortalToken generatePortalTokenHttp requestWorkspacePasswordReset provisionGoogleStaff prepareAgencyOpsTenant; do
  gcloud functions add-invoker-policy-binding "$FN" \
    --gen2 --region="$REGION" --project="$PROJECT" \
    --member="allUsers" \
    --role="roles/cloudfunctions.invoker" \
    --quiet || true
done

for SVC in verifyadminpasscode verifyadminpasscodehttp generateportaltoken generateportaltokenhttp requestworkspacepasswordreset prepareagencyopstenant; do
  gcloud run services add-iam-policy-binding "$SVC" \
    --region="$REGION" --project="$PROJECT" \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --quiet || true
done

gcloud iam service-accounts add-iam-policy-binding \
  413958125034-compute@developer.gserviceaccount.com \
  --project="$PROJECT" \
  --member="serviceAccount:413958125034-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --quiet
```

If bindings fail with `FAILED_PRECONDITION` / organization policy, **ignore them** — the Firestore passcode flow above does not need public functions.

## Cloud Functions deploy: HTTPS → Firestore trigger

If deploy fails with `Changing from an HTTPS function to a background triggered function` for `onAgencyOpsProvisionRequest`, delete the orphaned HTTPS version once, then redeploy. The live Firestore trigger is named **`processAgencyOpsProvisionRequest`** (renamed to avoid trigger-type conflicts).

```bash
gcloud functions delete onAgencyOpsProvisionRequest \
  --region=asia-southeast1 \
  --project=kolthoff-portal \
  --gen2 \
  --quiet
gcloud functions delete onAgencyOpsProvisionRequest \
  --region=asia-southeast1 \
  --project=kolthoff-portal \
  --quiet
npx firebase functions:delete onAgencyOpsProvisionRequest \
  --region asia-southeast1 --project kolthoff-portal --force
```

CI on `main` runs multi-path cleanup automatically before each functions deploy.

To temporarily allow public bindings, an org admin may need to relax **Domain restricted sharing** under IAM & Admin → Organization policies.
