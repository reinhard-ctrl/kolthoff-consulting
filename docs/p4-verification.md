# P4 — Production verification runbook

Walk through these flows on **production** after each major deploy. Target domains:

- Staff: [kolthoff-portal.web.app/admin](https://kolthoff-portal.web.app/admin/) or [kolthoff-consulting.com/admin](https://kolthoff-consulting.com/admin/)
- Clients: [kolthoff-consulting.com/apps/public/portal.html](https://kolthoff-consulting.com/apps/public/portal.html)

**Time:** ~30 minutes total (consulting ~15 min, PRO 1 ~15 min).

Hard-refresh staff apps after deploy: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows).

---

## Automated pre-check (engineering)

From repo root:

```bash
bash scripts/smoke-test.sh https://kolthoff-portal.web.app
bash scripts/smoke-test.sh https://kolthoff-consulting.com
```

Expect **0 failures**. Portal auth API should return JSON `404` with `"code":"not-found"` for a fake access code (not HTML 403).

---

## A — Consulting smoke test (MOD engagement)

Use an existing test client or create one in `/admin/portals` with a known access code.

| Step | Action | Pass? |
|------|--------|-------|
| A1 | Open **Contract Ledger** → copy client sign link | ☐ |
| A2 | Open sign link in incognito → complete signature | ☐ |
| A3 | Open portal → enter client **SOW tracking code** (access code) | ☐ |
| A4 | Portal loads client name, roadmap, and progress (no auth error) | ☐ |
| A5 | **Organization** tab shows org chart synced from `/admin/org-chart` | ☐ |
| A6 | Upload a test file in portal vault → success message | ☐ |
| A7 | Staff: open **Collections** → milestone or care-plan invoice prints | ☐ |

**Notes / failures:**

```
(date, tester, step, what happened)
```

---

## B — PRO 1 smoke test (Agency Ops product)

| Step | Action | Pass? |
|------|--------|-------|
| B1 | CRM: create or open deal tagged as **product** (Agency Ops) | ☐ |
| B2 | Planner: **Create quote** (blank workspace) — add line items in Estimate tab; no Engagement Packages screen | ☐ |
| B3 | Contract Ledger: send sign link → sign in incognito | ☐ |
| B4 | **Agency Ops Manager** (`/admin/agency-ops-manager`): tenant appears with status **ready** (may take ~2 min after sign on cold Functions). If empty, check **Provisioning in progress** or **Retry provision** panel | ☐ |
| B5 | Client opens `/agency-ops/?tenant=<slug>` with **passcode** (not Kolthoff admin) → Sales/Quotes loads with **your branding** and empty planner | ☐ |
| B6 | **Collections** → **PRO Subscriptions** tab → issue setup fee + monthly invoice | ☐ |
| B7 | **Agency Ops Manager** → select tenant in **Active Agency Ops tenant** dropdown → sidebar **Agency Ops** opens same `?tenant=` URL; **Reset passcode** works on a test tenant | ☐ |

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

## Common blockers

| Symptom | Fix |
|---------|-----|
| Portal “access denied” | Firebase Console → Auth → enable **Anonymous** |
| Portal auth API 403 | Expected with private invoker + org policy — portal uses Firestore-direct auth |
| Google SSO stuck | Add authorized domain + OAuth redirect URI — see `docs/app-check-sso.md` |
| Stale admin / 404 embed | Hard refresh; check CI build did not skip workspace |
| Console: staff SSO / provisioning timeout | Harmless — Google admin session still works; ignore or hard refresh |
| Agency Ops tenant missing after 2 min | Agency Ops Manager → **Retry provision** on failed deal, or **Provision** manually |

---

## Sign-off

When A + B + C pass on `kolthoff-consulting.com`:

- [ ] P4 consulting complete
- [ ] P4 PRO 1 complete
- [ ] Documented in team channel / audit log

Then shift primary focus to **Phase 4 content** (SOW library, CRM playbooks, portal defaults) per `docs/migration-roadmap.md`.
