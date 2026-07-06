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
| `policy_documents` | Policy Studio packs | keyed by profile ID |
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

## Related docs

- Engagement content schema: `docs/content-model.md`
- Intake seeding: `docs/data-seeding.md`
