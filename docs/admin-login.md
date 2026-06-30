# Admin login troubleshooting

Admin passcode verification uses **`/api/verify-passcode`** on Firebase Hosting, which rewrites to the Cloud Function `verifyAdminPasscodeHttp`. This path works when your GCP organization policy blocks granting `allUsers` the Cloud Run invoker role (common on corporate Google accounts).

## Normal flow

1. Open https://kolthoff-portal.web.app/admin/ (or https://kolthoff-consulting.com/admin/ after DNS cutover).
2. Enter the passcode stored in Firestore at  
   `artifacts/kolthoff-admin-app/public/data/admin_credentials/{PASSCODE}` with field `role: kolthoff_admin`.
3. After a valid passcode, the app signs in with a custom token.

## If you see "Cloud Function unreachable" or passcode service errors

### 1. Wait for deploy, then hard-refresh

After a push to `main`, GitHub Actions deploys hosting and functions (~3–5 minutes). Hard-refresh the admin page (Ctrl+Shift+R / Cmd+Shift+R).

### 2. Verify the hosting rewrite

```bash
curl -sS -X POST "https://kolthoff-portal.web.app/api/verify-passcode" \
  -H "Content-Type: application/json" \
  -d '{"code":"YOUR_PASSCODE"}'
```

Expected: JSON like `{"valid":false}` or `{"valid":true,"token":"..."}`.  
If you get **404 HTML**, hosting or the function did not deploy — check the latest [Firebase Deploy workflow](https://github.com/reinhard-ctrl/kolthoff-consulting/actions).

### 3. IAM fix in Cloud Shell (optional — direct callable only)

The legacy **callable** function `verifyAdminPasscode` requires public invoke. If org policy allows it, run in [Google Cloud Shell](https://shell.cloud.google.com/?project=kolthoff-portal):

```bash
PROJECT=kolthoff-portal
REGION=asia-southeast1

# Callable + Cloud Run invoker (fails if org policy blocks allUsers)
for FN in verifyAdminPasscode generatePortalToken; do
  gcloud functions add-iam-policy-binding "$FN" \
    --gen2 --region="$REGION" --project="$PROJECT" \
    --member="allUsers" \
    --role="roles/cloudfunctions.invoker" \
    --quiet || true
done

for SVC in verifyadminpasscode generateportaltoken; do
  gcloud run services add-iam-policy-binding "$SVC" \
    --region="$REGION" --project="$PROJECT" \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --quiet || true
done

# Custom tokens from Cloud Functions default runtime SA
gcloud iam service-accounts add-iam-policy-binding \
  413958125034-compute@developer.gserviceaccount.com \
  --project="$PROJECT" \
  --member="serviceAccount:413958125034-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --quiet
```

**Note:** If `allUsers` bindings fail with `FAILED_PRECONDITION` / organization policy, ignore them — the Hosting rewrite path does not need public invoke.

### 4. Firebase Auth API key referrers

After passcode validation, `signInWithCustomToken` uses the browser API key. In [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=kolthoff-portal), edit the **Browser key** and add HTTP referrers:

- `https://kolthoff-portal.web.app/*`
- `https://kolthoff-consulting.com/*`
- `https://www.kolthoff-consulting.com/*`

## Create an admin passcode (Firestore)

In Firebase Console → Firestore, create document:

- Collection path: `artifacts/kolthoff-admin-app/public/data/admin_credentials`
- Document ID: your passcode (e.g. `KOLTHOFF2026`)
- Field: `role` = `kolthoff_admin`
