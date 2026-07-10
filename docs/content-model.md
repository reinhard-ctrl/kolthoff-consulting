# Kolthoff Operations Suite — Content Model

This document describes the **canonical engagement content** shared across Project Planner, Leak Scan Report (admin route: Diagnosis Reports), CRM, Contract Ledger, Portal Manager, and Cloud Functions.

Implementation source: `shared/engagement-config.js` (HTML apps) and `admin/src/lib/engagement-config.ts` (React admin).

## Naming & voice

Use this hierarchy in client-facing copy (SOW, PDF, portal, marketing):

| Layer | Canonical name | Notes |
|-------|------------------|-------|
| Module (engagement phase) | **Business Leak Scan** | Mod 1 — org chart, as-is workflows, SaaS audit, strategy |
| Package (sales) | **Leak Scan** | Marketing and planner package id `leak-scan` |
| Deliverable (client output) | **Leak Scan Report** | Printable PDF + handoff (Drive/Loom) |
| Action plan | **90-Day Recovery Plan** | Top fixes inside the report; not a separate document name |
| Metric | **Operational leakage** | Process delays + subscription overlap |
| Branded hook (marketing only) | **Chaos Tax** | Calculator and homepage — always define as operational leakage |

**Consultant-facing only:** admin nav route id `diagnosis-reports`, Firestore slice `diagnosisWorkflow`, internal comments may say "diagnosis report."

**Avoid in client deliverables:** "waste," "money pit," "peso amounts," and currency-specific framing. Prefer *leakage*, *overlap*, *recovery*, and *recapture*.

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
    "crmStatus": "Won",
    "crmPipelineStatus": "Closed Won/Lost",
    "crmSyncedAt": 1700000000000,
    "portalClientId": "KC-2026-APARRI",
    "contractId": "contract-client-abc"
  }
}
```

Convention:

- CRM deal sync: `profile.quoteId === deal.id` **or** `links.crmDealId === deal.id`
- CRM → planner: when deal closes Won/Lost, CRM writes `links.crmStatus` + `links.crmPipelineStatus` (see `shared/crm-planner-sync.js`)
- Contract ledger doc: `contracts_ledger/contract-{profileId}`
- Portal client doc ID: typically `quoteId` (access code)

### Diagnosis & workflow slices

| Field | Writer | Notes |
|-------|--------|-------|
| `tabs[]`, `activeTabId` | Diagnosis / Workflow Builder | Legacy canonical view (merged from app slices) |
| `diagnosisWorkflow` | Diagnosis Reports | `{ tabs, activeTabId, updatedAt }` — each tab `present` uses draw.io BPMN (`drawioXml`, `svgCache`, `cellMeta`) |
| `workflowBuilder` | Workflow Builder | `{ tabs, activeTabId, updatedAt }` — BPMN to-be diagrams (same `present` shape) |
| `subSaaS` | Diagnosis / Intake | SaaS stack (Intake merges by tool name) |
| `raciAssignments` | Diagnosis | RACI matrix |
| `synthesis` | Diagnosis | Executive summary |

**Tabs merge (schema v2):** Each app saves its own slice, then merges into legacy `tabs[]` so older readers still work. Saves fetch the latest profile and merge tab IDs from both slices before writing.

### Intake mapping

Intake Center merges responses into profile fields by `mappedTarget`:

- `subSaaS` — merged by tool name (case-insensitive)
- `roles` — merged by employee name
- `customAssets` — appended with `_intakeAt` timestamp

See `INTAKE_MAPPED_TARGETS` in engagement config and `admin/src/lib/intake-merge.ts`.

When a linked client portal exists (`clients/{quoteId}`), Intake Center **auto-syncs** SaaS metrics and vault assets via `admin/src/lib/portal-sync.ts`.

## Phase 2 — portal bridge & single workflow editor

- **Diagnosis Reports** embeds Workflow Builder with `?slice=diagnosis`; saves to `diagnosisWorkflow`. Report reads via `WorkflowTabs.getDiagnosisTabs()`.
- **Workflow Builder (Mod 2)** saves to `workflowBuilder`; Policy Studio SOP sync uses `WorkflowTabs.getWorkflowTabs()`.
- **Intake → Portal** pushes merged intake data to `clients` when access code matches profile `quoteId`.

## Phase 3 — save → portal sync & bidirectional links

- **`shared/portal-sync.js`** mirrors `admin/src/lib/portal-sync.ts` for HTML apps (`window.PortalSync`).
- **Auto-sync on save:** Project Planner, Diagnosis Reports, and Policy Studio call `PortalSync.syncProfileToPortalIfExists()` after writing `workbook_profiles`.
- **Bidirectional links:** Portal Manager writes `links.portalClientId` back to the profile on import and access-code rename via `writePortalLinkToProfile()`.
- **Intake roles:** roster intake merges into profile `roles[]` and syncs to portal `actionItems` when a linked portal exists.
- **Cloud Function:** `onWorkbookProfileWritten` merges `_meta` (preserves client `updatedAt`) and validates `chaosTax` / `links`.
- **Display names:** CRM, Contract Sign, analytics HTML, and Policy Studio use `EngagementConfig.getClientDisplayName()` for profile labels.

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
| Diagnosis Reports | Profile list, tabs | `chaosTax`, `synthesis`, `subSaaS`, `raciAssignments` (tabs edited in Workflow Builder) |
| Workflow Builder | Profile list, tabs | `workflowBuilder` slice + merged `tabs` |
| CRM Pipeline | Profiles for deal value sync | Creates profile from deal (`quoteId = deal.id`) |
| Contract Ledger | Profiles | Read-only |
| Contract Sign | Profile by ID | Signature status → `contracts_ledger` |
| Portal Manager | Profiles | Creates `clients` from profile; sync-from-SOW; writes `links.portalClientId` |
| Intake Center | Profiles | Mapped intake fields |
| Cloud Function `onWorkbookProfileWritten` | Validates + caches `_meta.totalHours` | Merge `_meta` |

## Related docs

- Firestore collections overview: `docs/data-model.md`
- Intake seeding: `docs/data-seeding.md`
