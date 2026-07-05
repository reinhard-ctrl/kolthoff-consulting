# Kolthoff Product (PRO) Catalog

Subscription software SKUs sold through Kolthoff OS — separate from MOD consulting services.

Implementation source: `shared/product-catalog.js`, `shared/engagement-packages.js`, and Kolthoff OS Project Planner.

## Taxonomy

| SKU | ID | Category | Status |
|-----|-----|----------|--------|
| PRO 1 · Agency Ops | `pro1` | PRO 1 - Agency Ops Platform | Active |
| PRO 2 · Core Workspace | `pro2` | PRO 2 - Core Workspace Platform | Planned |

## Lead-to-cash (Kolthoff OS)

1. **CRM** — Tag deal as `PRO · Product Subscription` (`dealCategory: product`)
2. **Planner** — Apply **Agency Ops Starter** package (`pro1-agency-ops-starter`)
3. **Documents** — PRO template: SOW + Quote + **Platform SLA** (no consulting roadmap)
4. **Contract sign** — `contract_sign.html`
5. **Auto-provision** — Firestore trigger `onContractLedgerWritten` provisions Agency Ops when status → `signed` (PRO 1 only)
6. **CRM sync** — Same trigger marks linked CRM deal **Won**
7. **Collections** — **PRO Subscriptions** tab: issue setup milestones + monthly platform invoices (v1 rhythm)
8. **Manual retry** — Agency Ops Manager or Contract Ledger if auto-provision fails

## Agency Ops tenant registry

Path:

```
artifacts/kolthoff-admin-app/public/data/agency_ops_tenants/{tenantId}
```

Workbook profile fields after provisioning:

| Field | Notes |
|-------|--------|
| `agencyOpsTenantId` | e.g. `agency-pixel-wave` |
| `provisioningStatus` | `ready` \| `provisioning` \| `failed` |
| `provisioningError` | Set when auto-provision fails |
| `links.agencyOpsConsoleUrl` | Console URL with `?tenant=` |
| `subscriptionBilling.enabled` | Set on contract sign for PRO 1 |
| `subscriptionBilling.contractSignedAt` | Anchor for first billing period |

Console URL pattern: `https://kolthoff-consulting.com/agency-ops/?tenant=agency-{slug}`

## Collections — PRO subscription rhythm

In Kolthoff OS (`/admin/collections`), the **PRO Subscriptions** tab lists signed PRO 1 contracts:

1. **Setup milestones** — Issue 50/50 (or configured split) setup invoices
2. **Monthly platform fee** — One-click issue for the next billing month (`retainer_monthly`)

Helpers: `shared/subscription-billing.js`. Invoice labels use **PRO 1 · Agency Ops** instead of MOD 4 Care Plan.

## Profile fields (workbook_profiles)

| Field | Values | Notes |
|-------|--------|-------|
| `engagementType` | `service` \| `product` | Set when applying a package |
| `productId` | `pro1`, `pro2`, or null | Active PRO SKU when `engagementType === 'product'` |
| `selectedPackageId` | e.g. `pro1-agency-ops-starter` | Links to engagement-packages |

## PRO 1 package tasks

| Task ID | Deliverable | Billing |
|---------|-------------|---------|
| `pro1-01` | Platform Setup & White-Label Configuration | One-time setup |
| `pro1-02` | Agency Team Onboarding & Training | One-time |
| `pro1-03` | Agency Ops Platform Subscription | Monthly retainer |

## Pricing anchors (reference)

- Setup: ~₱8,000–₱15,000
- Subscription: ~₱3,500–₱5,500 / month

Adjust hours and rates in Planner per deal.

## Rules

- Do **not** use Agency Ops demo (`agency-ops-demo`) to sell PRO to agencies — close in Kolthoff OS
- PRO Platform SLA is **separate** from MOD 3/4 consulting SLA
- MOD 3 agency variant applies only when the **client is an agency** (consulting delivery); PRO 1 is the product SKU
