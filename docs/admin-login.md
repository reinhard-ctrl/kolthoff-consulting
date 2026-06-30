# Admin login troubleshooting

Admin passcode login uses **Firestore directly** (no public Cloud Function required). This works when your GCP organization policy blocks granting `allUsers` the Cloud Run invoker role.

## Normal flow

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

Enable **Anonymous** sign-in in Firebase Console → Authentication → Sign-in method.

### API key HTTP referrers

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials?project=kolthoff-portal), edit the **Browser key** and add:

- `https://kolthoff-portal.web.app/*`
- `https://kolthoff-consulting.com/*`
- `https://www.kolthoff-consulting.com/*`

Browser key prefix: `AIzaSyDtWOj19Pw0n7NGo4JQZ7sbLcazu_XZzNI`

## Common errors

| Symptom | Fix |
|--------|-----|
| `auth/requests-from-referer-blocked` | Add site URL to API key HTTP referrers (above) |
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

for FN in verifyAdminPasscode verifyAdminPasscodeHttp generatePortalToken; do
  gcloud functions add-invoker-policy-binding "$FN" \
    --gen2 --region="$REGION" --project="$PROJECT" \
    --member="allUsers" \
    --role="roles/cloudfunctions.invoker" \
    --quiet || true
done

for SVC in verifyadminpasscode verifyadminpasscodehttp generateportaltoken; do
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

To temporarily allow public bindings, an org admin may need to relax **Domain restricted sharing** under IAM & Admin → Organization policies.
