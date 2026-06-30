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
| `clients` | Client portal records | access code = doc ID, metrics, roadmap |
| `workbook_profiles` | SOW planner profiles | tasks[], frictionBuffer, discountPercent |
| `intake_forms` | Intake form definitions | fields, responses |
| `intake_templates` | Reusable form templates | fields |
| `contracts_ledger` | E-sign status | status, signatureName, signedAt, ip |
| `admin_credentials` | Admin passcodes (Firestore) | role |
| `core_users` | Workspace users | email, role, departmentId, firebaseUid |
| `core_departments` | Org structure | name, parentId |
| `core_templates` | Approval form templates | fields, flowSteps |
| `core_requests` | Approval requests | templateId, status, formData |
| `core_chats` / `core_messages` | Messenger | participants, text, timestamp |
| `core_policies` | Policy vault | title, content (markdown) |
| `core_it_requests` | IT helpdesk | status, description |
| `crm_deals` | CRM pipeline (HTML + workspace) | pipelineStatus, estValue, company |
| `core_workflows` | Workflow blueprints | steps[] |
| `core_audit_log` | Audit trail | action, userId, timestamp |
| `tenant_settings` | Feature flags | config.features |
| `master_templates` | Global blueprints | fields, flowSteps |
| `diagnosis_reports` | MOD 1 reports | profileId, findings |
| `resource_capacity` | Team allocations | member, hours, project |
| `time_entries` | Actual vs planned hours | planned, actual, taskName |
| `firm_analytics` | Aggregated metrics | (computed) |

## Storage Paths

```
artifacts/{tenantId}/files/{clientId}/{filename}
```

## Auth Custom Claims

| Claim | Values |
|-------|--------|
| `role` | `kolthoff_admin`, `admin`, `user`, `portal_client` |
| `tenantId` | Tenant namespace ID |
| `accessCode` | Portal client access code |
