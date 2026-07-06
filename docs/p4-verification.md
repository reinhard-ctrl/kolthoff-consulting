# P4 — Production verification runbook

Walk through these flows on **production** after each major deploy. Target domains:

- Staff: [kolthoff-portal.web.app/admin](https://kolthoff-portal.web.app/admin/) or [kolthoff-consulting.com/admin](https://kolthoff-consulting.com/admin/)
- Clients: [kolthoff-consulting.com/apps/public/portal.html](https://kolthoff-consulting.com/apps/public/portal.html)

**Time:** ~45 minutes total (consulting ~15 min, PRO 1 ~15 min, Core Workspace pilot ~15 min).

Hard-refresh staff apps after deploy: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows).

---

## Automated pre-check (engineering)

From repo root:

```bash
bash scripts/smoke-test.sh https://kolthoff-portal.web.app
bash scripts/smoke-test.sh https://kolthoff-consulting.com
```

Expect **0 failures** (27 routes). Portal auth API should return JSON `404` with `"code":"not-found"` for a fake access code (not HTML 403).

Section **C** embed shell routes (`/admin/app/resource-capacity`, `/admin/app/project-planner`) are covered by smoke. Sections **A**, **B**, and **D** remain manual regression checks after major deploys.

---

## A — Consulting smoke test (MOD engagement)

Use an existing test client or create one in `/admin/portals` with a known access code.

| Step | Action | Pass? |
|------|--------|-------|
| A1 | Open **Contract Ledger** → copy client sign link | ☑ |
| A2 | Open sign link in incognito → complete signature | ☑ |
| A3 | Open portal → enter client **SOW tracking code** (access code) | ☑ |
| A4 | Portal loads client name, roadmap, and progress (no auth error) | ☑ |
| A5 | **Organization** tab shows org chart synced from `/admin/org-chart` | ☑ |
| A6 | Upload a test file in portal vault → success message | ☑ |
| A7 | Staff: open **Collections** → milestone or care-plan invoice prints | ☑ |

**Notes / failures:**

```
(date, tester, step, what happened)
```

---

## B — PRO 1 smoke test (Agency Ops product)

| Step | Action | Pass? |
|------|--------|-------|
| B1 | CRM: create or open deal tagged as **product** (Agency Ops) | ☑ |
| B2 | Planner: **Create quote** (blank workspace) — add line items in Estimate tab; no Engagement Packages screen | ☑ |
| B3 | Contract Ledger: send sign link → sign in incognito | ☑ |
| B4 | **Agency Ops Manager** (`/admin/agency-ops-manager`): tenant appears with status **ready** (may take ~2 min after sign on cold Functions). If empty, check **Provisioning in progress** or **Retry provision** panel | ☑ |
| B5 | Client opens `/agency-ops/?tenant=<slug>` with **passcode** (not Kolthoff admin) → Sales/Quotes loads with **your branding** and empty planner | ☑ |
| B6 | **Collections** → **PRO Subscriptions** tab → issue setup fee + monthly invoice | ☑ |
| B7 | **Agency Ops Manager** → select tenant in **Active Agency Ops tenant** dropdown → **Open Agency Ops console** opens correct `?tenant=` URL; **Reset passcode** works on a test tenant | ☑ |

**Notes / failures:**

```
(date, tester, step, what happened)
```

---

## C — Admin embed sanity (quick)

| Route | Expect |
|-------|--------|
| `/admin/app/resource-capacity` | Kanban + left analytics sidebar visible |
| `/admin/app/project-planner` | Planner loads inside admin frame |

---

## D — Core Workspace pilot (MOD / PRO 2)

Use a test MOD engagement or **Workspace Admin → Onboard** tab.

| Step | Action | Pass? |
|------|--------|-------|
| D0 | **Quick provision** (`/admin/tenants` → Instances): create test tenant → completes in seconds (direct Firestore; no CORS/timeout) | ☑ |
| D1 | **Workspace Admin** → **Onboard** tab: select SOW profile → provision → workspace URL + portal code returned | ☑ |
| D2 | **Workspace Admin** (`/admin/tenants`): tenant appears; deploy starter approval templates if not auto-deployed | ☑ |
| D3 | Open Core Workspace (`/workspace/?tenant=client-*`) → **Approvals**: submit request → appears in assignee's "Pending My Approval" | ☑ |
| D4 | Assignee approves/rejects with comment → requester sees updated status + history | ☑ |
| D5 | Sidebar badge on Approvals clears after opening the pending request | ☑ |
| D6 | **Messenger**: create chat, send message, attach file → recipient sees unread badge | ☑ |
| D7 | (Optional) Sign MOD contract in incognito → `client_provision_requests` completes → portal shows Core Workspace link | ☑ |

**Notes / failures:**

```
(date, tester, step, what happened)
```

---

## Common blockers

| Symptom | Fix |
|---------|-----|
| Portal “access denied” | Firebase Console → Auth → enable **Anonymous** |
| Portal auth API 403 | Expected with private invoker + org policy — portal uses Firestore-direct auth |
| Google SSO stuck | Add authorized domain + OAuth redirect URI — see `docs/app-check-sso.md` |
| Stale admin / 404 embed | Hard refresh; check CI build did not skip workspace |
| Console: staff SSO / provisioning timeout | Harmless — Google admin session still works; ignore or hard refresh |
| Quick provision CORS / timeout | Hard refresh after deploy #217+; uses direct Firestore first — no callable required |
| `/workspace/` shows landing only | Expected — open `/workspace/?tenant=client-*` from provision success modal |
| Agency Ops tenant missing after 2 min | Agency Ops Manager → **Retry provision** on failed deal, or **Provision** manually |

---

## Sign-off

When A + B + C + D pass on `kolthoff-consulting.com`:

- [x] P4 consulting complete
- [x] P4 PRO 1 complete
- [x] Core Workspace pilot complete
- [x] Documented in team channel / audit log

**Status:** P4 complete (6 Jul 2026). Primary focus → **Phase 4 content** per `docs/migration-roadmap.md`.
