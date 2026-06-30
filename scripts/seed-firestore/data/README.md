# Seed data files

JSON arrays of documents. Each object must include `"id"` (Firestore document ID).

| File | Collection | Status |
|------|------------|--------|
| `crm_deals.json` | `crm_deals` | **Populated** — pipeline deals |
| `crm_contacts.json` | `crm_contacts` | **Populated** |
| `crm_partners.json` | `crm_partners` | **Populated** |
| `tenant_settings.json` | `tenant_settings` | **Populated** — doc `config` with feature flags |
| `core_departments.json` | `core_departments` | **Populated** — org structure |
| `workbook_profiles.json` | `workbook_profiles` | Empty — add SOW exports from Project Planner |
| `clients.json` | `clients` | Empty — add portal records or create via Admin Console |

## Adding workbook profiles

1. Open Project Planner locally or on Firebase (after admin login).
2. Configure each SOW, then use workspace export if available, or copy profile fields.
3. Add objects to `workbook_profiles.json` with `"id"` matching the profile slug (e.g. `gts-2026`).
4. Re-run: `bash scripts/seed-production-data.sh --only workbook_profiles`

## Adding client portals

Each client doc ID is the portal access code. Typical fields:

```json
{
  "id": "KC-2026-GTS",
  "companyName": "Good Transport Solutions Inc.",
  "repName": "Gian Joaquin",
  "sowReference": "KC-2026-GTS",
  "currentPhase": "MOD 1: Workflow Diagnosis",
  "progressPercentage": 0,
  "metrics": { "annualLeakageIdentified": 0, "chaosTaxEliminated": 0, "saasSavingsIdentified": 0 },
  "actionItems": [],
  "roadmap": [],
  "assets": [],
  "contracts": []
}
```

Or create from Admin Console → Import Profile from an existing SOW.
