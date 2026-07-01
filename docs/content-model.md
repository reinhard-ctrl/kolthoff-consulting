# Kolthoff Operations Suite — Content Model

This document describes the **canonical engagement content** shared across Project Planner, Diagnosis Reports, CRM, Contract Ledger, Portal Manager, and Cloud Functions.

Implementation source: `shared/engagement-config.js` (HTML apps) and `admin/src/lib/engagement-config.ts` (React admin).

## Anchor document: `workbook_profiles`

Path:

```
artifacts/{tenantId}/public/data/workbook_profiles/{profileId}
```

Each profile is the **single content hub** for a client engagement. Multiple apps write slices of the same document (merge writes).

### Schema version

Profiles written by Project Planner include:

```json
{
  "_meta": { "schemaVersion": 2, "updatedAt": 1700000000000 }
}
```

Legacy profiles without `_meta` remain valid; readers fall back to field-level defaults.

### Identity & client fields

| Field | Writer | Notes |
|-------|--------|-------|
| `id` | Planner | Document ID |
| `workspaceName` | Planner | Display label in workspace picker |
| `clientCompany` | Planner | **Canonical** legal company name |
| `clientName` | Legacy | Deprecated alias; Cloud Function accepts either |
| `clientRep` | Planner | Primary contact |
| `clientAddress`, `clientTin` | Planner | Contract / invoice |
| `quoteId` | Planner / CRM import | SOW reference; **CRM sync key** when equal to `crm_deals.id` |
| `quoteDate`, `quoteValidity` | Planner | Proposal metadata |

**Display name resolution:** `clientCompany` → `clientName` → `"Untitled Client"`

### Financial & SOW fields

| Field | Writer | Notes |
|-------|--------|-------|
| `tasks[]` | Planner | Selected modules, hours, tiers, categories |
| `frictionBuffer`, `discountPercent`, rates | Planner | Economics inputs |
| `milestoneSplit`, `customSplit*` | Planner | Billing structure |
| `applyCreditBack`, `creditBackDays` | Planner | MOD 1 credit-back gate |

Downstream totals use `shared/financials.js` / `admin/src/lib/financials.ts`. CRM deal value sync uses **`getFinancials(profile).total`** (includes VAT when enabled).

### Chaos tax (operational leakage)

Two writers can populate leakage estimates:

| Field | Source app | Formula |
|-------|------------|---------|
| `chaosTax` | Planner (primary) or Diagnosis | Structured slice — see below |
| `annualOperationalLeakage` | Planner / Diagnosis | Legacy flat number; kept for backward compatibility |

**Chaos tax slice:**

```json
{
  "chaosTax": {
    "source": "planner",
    "value": 1125000,
    "inputs": { "staffCount": 15, "monthlySalary": 25000, "wastedHours": 2 }
  }
}
```

- **Planner:** `staffCount × monthlySalary × 12 × (wastedHours / 8)`
- **Diagnosis:** flowchart-derived annual total (`source: "diagnosis"`)

Readers should use `resolveChaosTax(profile)` which prefers `chaosTax.value`, then falls back to `annualOperationalLeakage`.

### Cross-app links

```json
{
  "links": {
    "crmDealId": "deal-abc123",
    "portalClientId": "KC-2026-APARRI",
    "contractId": "contract-client-abc"
  }
}
```

Convention:

- CRM deal sync: `profile.quoteId === deal.id` **or** `links.crmDealId === deal.id`
- Contract ledger doc: `contracts_ledger/contract-{profileId}`
- Portal client doc ID: typically `quoteId` (access code)

### Diagnosis & workflow slices

| Field | Writer | Notes |
|-------|--------|-------|
| `tabs[]`, `activeTabId` | Diagnosis / Workflow Builder | Flowchart tabs (merge carefully) |
| `subSaaS` | Diagnosis / Intake | SaaS stack |
| `raciAssignments` | Diagnosis | RACI matrix |
| `synthesis` | Diagnosis | Executive summary |

**Caution:** concurrent saves from Diagnosis and Workflow can overwrite `tabs` if not coordinated. Prefer merge writes and app-specific sub-keys in future schema versions.

### Intake mapping

Intake Center merges responses into profile fields by `mappedTarget`:

- `subSaaS`
- `roles`
- `customAssets`

See `INTAKE_MAPPED_TARGETS` in engagement config.

## MOD 1–4 canonical names

| ID | Category (task.category) | Portal phase |
|----|--------------------------|--------------|
| mod1 | MOD 1 - Business Leak Scan | MOD 1: Business Leak Scan |
| mod2 | MOD 2 - How Your Business Runs | MOD 2: How Your Business Runs |
| mod3 | MOD 3 - Your Team Workspace | MOD 3: Your Team Workspace |
| mod4 | MOD 4 - Care Plan | MOD 4: Care Plan |

Legacy category strings (pre-2026 rename) remain mapped via `CATEGORY_TO_PRESET` aliases.

## Downstream consumers

| App | Reads | Writes |
|-----|-------|--------|
| Project Planner | Full profile | Full profile + `_meta`, `chaosTax`, `links` |
| Diagnosis Reports | Profile list, tabs | `tabs`, `chaosTax`, `annualOperationalLeakage`, `synthesis`, `subSaaS`, `raciAssignments` |
| Workflow Builder | Profile list, tabs | `tabs` |
| CRM Pipeline | Profiles for deal value sync | Creates profile from deal (`quoteId = deal.id`) |
| Contract Ledger | Profiles | Read-only |
| Contract Sign | Profile by ID | Signature status → `contracts_ledger` |
| Portal Manager | Profiles | Creates `clients` from profile; sync-from-SOW |
| Intake Center | Profiles | Mapped intake fields |
| Cloud Function `onWorkbookProfileWritten` | Validates + caches `_meta.totalHours` | Merge `_meta` |

## Related docs

- Firestore collections overview: `docs/data-model.md`
- Intake seeding: `docs/data-seeding.md`
