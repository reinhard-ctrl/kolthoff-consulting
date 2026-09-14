# Policy Studio — client handoff & maintenance

How to turn over a pack and keep it healthy after engagement.

## Roles in the product

| Mode | Who | What they see |
|------|-----|----------------|
| **Consultant** | Kolthoff delivery | Full tooling (JSON, Google Doc import/export, reset templates, branding shortcuts) |
| **Maintainer** | Client policy owner | Create / organize / store loop — Save draft → Publish approved → Export snapshot |

Toggle **Consultant / Maintainer** in the Policy Studio header (persists in `localStorage`). Append `?role=maintainer` to force maintainer on first load.

## Recommended pack shape

Keep the five categories unless the client truly needs another:

1. **Operations** — SOPs, BCP, Health & Safety  
2. **Client Delivery** — SLA, Communication Plan  
3. **People** — Handbook, Job Role Profiles, Onboarding, Performance Reviews  
4. **Governance** — Org Chart, RACI, Manager Governance & Authority Charter  
5. **Compliance** — Conduct, NDA, Data Privacy  

Delete unused built-ins before handoff (**Remove** on the dashboard → **Save draft**). Tombstones persist so defaults do not resurrect.

## Create · Organize · Store

| Step | Action | Meaning |
|------|--------|---------|
| **1. Save draft** | Header → *Save draft* | Cloud source of truth (working copy) |
| **2. Publish approved** | Header → *Publish approved* | Workspace Vault — what the wider team should treat as current |
| **3. Export snapshot** | Header → *Export snapshot* | Offline HTML for board/audit — not for day-to-day edits |

Also available: **PDF** of the open document. Consultant-only: JSON vault dump, Google Doc Word export, template reset.

### Import from Google Drive
On chaptered policies (Conduct, NDA, Data Privacy, BCP, H&S, SLA, Onboarding, Performance Reviews) **and any new custom policy** created via **+ Add policy**, **Import Google Doc** accepts:
1. A shareable Docs/Drive link (**Anyone with the link can view**), or  
2. An uploaded **Web Page (.html)** export (best fidelity), or pasted text/HTML  

Mapping: Heading 1 → title, Heading 2 → chapters, Heading 3 → sections, Doc tables → table sections. Document control fields are preserved; **Save draft** after apply.

Requires **Consultant** role + **Edit** mode. Not available on structured packs (Org Chart, RACI, Manager Governance, Communication Plan) or while in Maintainer / Preview.

### Create
- **+ Add policy** — blank chaptered draft  
- **Manage categories → Restore** — bring back a removed library default  
- SOP / Job Role **+ New** under those groups  

### Organize
- Prefer the five categories; add a custom category only for a real domain (e.g. Finance)  
- One Document Control owner per policy  
- Align Org Chart → Manager Governance & Authority Charter → Job Role Profiles → SOPs after org changes  

### Store
- Daily/weekly work → **Save draft**  
- After approval → **Publish approved**  
- Board pack / offline → **Export snapshot** or **PDF**  

## Cadence to leave with the client

| When | Do |
|------|----|
| **Monthly** | Owners refresh *Last reviewed* on anything that changed; clear the dashboard **Needs attention** queue |
| **Quarterly** | Prune unused drafts; check RACI/DOA vs org chart; republish Vault |
| **Org change** | Update Org Chart → Manager Governance & Authority Charter → Job Roles → affected SOPs, then Save + Publish |

Name a **Policy Owner** (Ops/HR) and **Approver** (CEO/COO). Edits without an approver drift.

## Handoff checklist

1. Trim pack to policies the client will own; remove the rest and Save  
2. Fill Document Control (owner, version, effective, last reviewed) on live docs  
3. Switch UI to **Maintainer** and walk Save → Publish → Export once  
4. Publish approved to Vault  
5. Export snapshot HTML once as a baseline archive  
6. Point them at this doc and the dashboard **Create · Organize · Store** strip  

## Related

- Data shape: `docs/data-model.md` (`policy_documents`, `policyCatalog`)  
- Standalone export bundles `shared/*.js` so downloaded portals keep catalog navigation  
