# Kolthoff OS — Firestore Data Model

All tenant data lives under:

```
artifacts/{tenantId}/public/data/{collection}/{docId}
```

Default Kolthoff admin tenant: `kolthoff-admin-app`  
Client workspaces use distinct tenant IDs (e.g. `client-acme-corp`).

## Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `clients` | Client portal records | access code = doc ID, metrics, roadmap, assets[].gDriveLink |
| `workbook_profiles` | SOW planner profiles | tasks[], frictionBuffer, synthesis, tabs (diagnosis/workflow) |
| `intake_forms` | Intake form submissions | profileId, status, responses |
| `intake_templates` | Reusable form templates | fields, mappedTarget |
| `contracts_ledger` | E-sign status | doc ID `contract-{profileId}`, status, signatureName, signedAt |
| `invoices` | AR / collections | profileId, invoiceNumber, milestoneKey, total, amountPaid, status, dueDate |
| `withholding_2307` | Form 2307 certificates received | clientCompany, period, amount, receivedDate |
| `registration_2303` | Form 2303 COR (Certificate of Registration) | clientCompany, tin, corNumber, issueDate, rdo, taxType, verifiedDate |
| `admin_credentials` | Admin passcodes | role |
| `admin_sessions` | Active admin login sessions | passcodeVerified, verifiedAt |
| `core_users` | Workspace users | email, role, departmentId, firebaseUid |
| `core_departments` | Org structure | name, parentId |
| `core_templates` | Approval form templates | fields, flowSteps (assigneeType, role) |
| `core_requests` | Approval requests | templateId, status, formData, currentStepIndex, currentAssigneeIds, currentAssigneeFirebaseUids, stepHistory |
| `core_chats` / `core_messages` | Messenger | participants, text, timestamp, type, fileUrl, fileName |
| `core_notifications` | In-app alerts (Cloud Function) | userId, type, title, body, requestId, read |
| `core_policies` | Policy vault | title, content (markdown) |
| `core_it_requests` | IT helpdesk | status, description |
| `crm_deals` | CRM pipeline | pipelineStatus, estValue, company, status |
| `crm_contacts` | CRM network contacts | name, label, nextAction |
| `crm_partners` | Strategic partners | businessProposal, investmentBudget, phase |
| `policy_documents` | Policy Studio packs | keyed by profile ID — see below |
| `time_logs` | Time tracking entries | profileId, taskName, planned, actual |
| `resource_tasks` | Capacity allocations | member, hours, profileId |
| `team_members` | Resource pool | name, role, capacity |
| `core_audit_log` | Audit trail | action, userId, timestamp |
| `tenant_settings` | Feature flags | doc `config` → features.messenger/approvals/vault/crm |
| `master_templates` | Global blueprints | fields, flowSteps |
| `client_provision_requests` | Async Core Workspace provision queue | status, clientName, tenantId, profileId |
| `core_workspaces` | Client workspace registry | tenantId, clientName, workspaceUrl, portalAccessCode |

## Storage Paths

```
artifacts/{tenantId}/files/{clientId}/{filename}
artifacts/{tenantId}/files/messenger/{chatId}/{filename}
```

## Auth Custom Claims

| Claim | Values |
|-------|--------|
| `role` | `kolthoff_admin`, `admin`, `user`, `portal_client` |
| `tenantId` | Tenant namespace ID |
| `accessCode` | Portal client access code |

## Policy Studio — `policy_documents/{profileId}`

Standard pack shape:

| Field | Notes |
|-------|--------|
| `sops[]` | SOP manuals (steps, RACI, doc control) |
| `handbook` | Employee handbook |
| `standardDocs` | Policy templates (built-in keys + custom drafts) — see keys below |
| `policyCatalog` | Nav enablement, categories, and tombstones — see below |

### `policyCatalog` (pack library / navigation)

Controls which drafts appear in the Policy Studio dashboard and sidebar. Deleting a built-in policy adds its key to `removedDefaults` so it does **not** reseed on reload. Custom drafts live in `customDocs` with bodies under `standardDocs[customKey]`.

| Field | Type | Notes |
|-------|------|--------|
| `version` | number | Currently `1` |
| `removedDefaults` | string[] | Built-in keys tombstoned (e.g. `nda`, `sops`) |
| `removedCategories` | string[] | Built-in category ids removed from the pack |
| `customDocs` | array | `{ key, title, blurb, categoryId, kind }` — `kind` is `chapters` or `sections` |
| `customCategories` | array | `{ id, title, subtitle }` |
| `categoryOrder` | string[] | Display order of category ids |
| `categoryAssignments` | object | `{ [docKey]: categoryId }` overrides |
| `collapsedCategories` | string[] | Optional UI collapse hints |

**Recommended default categories:** Operations (SOPs, BCP, Health & Safety), Client Delivery (SLA, Communication Plan), People (Handbook, Job Role Profiles, Onboarding, Performance Reviews), Governance (Org Chart, RACI, Manager Governance & Authority Charter), Compliance (Conduct, NDA, Data Privacy).

### Chaptered policy sections (`standardDocs.*.chapters`)

Prose policies (Conduct, NDA, BCP, SLA, etc.) use chapters with typed sections:

| Field | Type | Notes |
|-------|------|--------|
| `kind` | string | `text` (default) or `table` |
| `content` | string | Markdown body when `kind === 'text'` |
| `table` | object | `{ headers: string[], rows: [{ id, cells: string[] }] }` when `kind === 'table'` (Firestore-safe; no nested arrays) |

Table sections are first-class outline items (same numbering as prose sections). Compiled markdown emits a GFM pipe table under the section heading.

### `standardDocs.orgChart` (Org Chart & Reporting Policy)

Published to Vault as `doc-orgChart`. Official org chart for clients comes from Policy Studio (workspace org chart is draft/source).

| Field | Type | Notes |
|-------|------|--------|
| `title` | string | e.g. Organizational Structure & Reporting Policy |
| `docControl` | object | version, effectiveDate, lastReviewed, owner |
| `introduction` | string | Policy narrative |
| `sections[]` | array | Purpose, reporting structure, decision authority, etc. |
| `diagram.drawioXml` | string | draw.io mxGraphModel XML (canonical visual) |
| `diagram.svgCache` | string | Exported SVG data URI for PDF/Vault |
| `diagram.layout` | string | `horizontalTree` \| `verticalTree` |
| `roster[]` | array | Parsed `{ id, name, title, department, reportsTo }` |
| `link.lastSyncedAt` | number | When diagram was synced from `workbook_profiles.orgChart` |

### `standardDocs.raci` (RACI & Decision Authority Policy)

Published to Vault as `doc-raci`. Separate from Org Chart; owns financial DOA limits and the decision-authority matrix.

| Field | Type | Notes |
|-------|------|--------|
| `title` | string | e.g. RACI & Decision Authority |
| `docControl` | object | version, effectiveDate, lastReviewed, owner |
| `introduction` | string | Policy narrative |
| `sections[]` | array | Guidance / definitions |
| `doa` | object | Financial Delegation of Authority: `{ intro, note, rows: [{ id, role, opexLimit, capexLimit, contractLimit }] }` |
| `matrices[]` | array | Topic groups `{ id, title, rows: [{ id, activity, responsible, accountable, consulted, informed }] }` |
| `matrix[]` | array | Flat mirror of all RACI rows (compat / older readers) |

Compiled markdown order: (1) Financial DOA Limits table, (2) Authorization and Decision Matrix (RACI) by topic. Legacy flat `matrix` / `orgChart.raciMatrix` is normalized into a single `matrices[]` topic group on load. Missing `doa` is filled from defaults on merge.

### `standardDocs.communicationPlan` (Communication Plan Policy)

Published to Vault as `doc-communicationPlan`. Defines meeting cadence tiers and approved tools/channels.

| Field | Type | Notes |
|-------|------|--------|
| `title` | string | e.g. Communication Plan |
| `docControl` | object | version, effectiveDate, lastReviewed, owner |
| `introduction` | string | Policy narrative |
| `sections[]` | array | Guidance / norms |
| `tiers[]` | array | Cadence tiers `{ id, tier, name, cadence, duration, purpose, attendees, owner, channel }` |
| `channels[]` | array | Tools `{ id, tool, purpose, audience, cadenceOrSla, notes }` |

Compiled markdown order: (1) Meeting Cadence Tiers, (2) Tools & Channels, then `sections[]`. Missing tiers/channels are filled from defaults on merge.

### `standardDocs.managerialRoles` (Manager Governance & Authority Charter)

Published to Vault as `doc-managerialRoles`. Formal managerial / executive governance and authority pack by division (reference: HR-JD style managerial JD documents).

| Field | Type | Notes |
|-------|------|--------|
| `title` | string | e.g. Manager Governance & Authority Charter |
| `documentRef` | string | e.g. HR-JD-2026-001 |
| `docControl` | object | version, effectiveDate, lastReviewed, owner, approvedBy |
| `introduction` | string | Policy narrative |
| `sections[]` | array | Optional guidance sections |
| `divisions[]` | array | `{ id, number, title, roles: [{ id, number, title, incumbent, reportsTo, directReports, summary, accountable, responsible, consulted, informed, specialAuthority, approvalLimits, responsibilities }] }` |

Compiled markdown groups roles under numbered divisions. Missing `divisions` are filled from defaults on merge.

### `workbook_profiles.orgChart` (workspace draft)

| Field | Type | Notes |
|-------|------|--------|
| `drawioXml` | string | draw.io org chart (Mod 1 as-is / Mod 2 to-be) |
| `members[]` | array | Legacy roster; used as fallback when no `drawioXml` |

## Related docs

- Engagement content schema: `docs/content-model.md`
- Intake seeding: `docs/data-seeding.md`
