import { useEffect, useMemo, useState } from 'react';
import { getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { adminCol, adminDoc } from '../lib/firebase';
import { getClientDisplayName } from '../lib/engagement-config';
import {
  buildOrgChartTree,
  createOrgMemberId,
  emptyOrgMember,
  isDescendantMember,
  managerName,
  resolveOrgChartFromProfile,
  type OrgChartMember,
  type OrgChartTreeNode,
} from '../lib/org-chart';
import { resolvePortalAccessCode, syncProfileToPortalIfExists } from '../lib/portal-sync';

interface WorkbookProfile {
  id: string;
  clientCompany?: string;
  clientName?: string;
  clientRep?: string;
  quoteId?: string;
  orgChart?: { members?: OrgChartMember[]; updatedAt?: string };
  roles?: Array<{ owner?: string; name?: string; role?: string; title?: string }>;
}

function OrgTreeNode({ node, depth = 0 }: { node: OrgChartTreeNode; depth?: number }) {
  return (
    <div className={depth ? 'ml-5 border-l border-brandNavy-700 pl-3' : ''}>
      <div className="py-1.5">
        <div className="text-sm font-semibold text-slate-100">{node.name || 'Unnamed'}</div>
        <div className="text-[11px] text-slate-400">
          {[node.role, node.department].filter(Boolean).join(' · ') || 'Role pending'}
        </div>
      </div>
      {node.children.map((child) => (
        <OrgTreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function OrgChart() {
  const [profiles, setProfiles] = useState<WorkbookProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrgChartMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  useEffect(() => {
    return onSnapshot(adminCol('workbook_profiles'), (snap) => {
      const list: WorkbookProfile[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as WorkbookProfile));
      list.sort((a, b) => getClientDisplayName(a).localeCompare(getClientDisplayName(b)));
      setProfiles(list);
      setActiveProfileId((prev) => prev ?? list[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!activeProfile) {
      setMembers([]);
      return;
    }
    const chart = resolveOrgChartFromProfile(activeProfile);
    setMembers(chart.members);
  }, [activeProfileId, activeProfile]);

  const tree = useMemo(() => buildOrgChartTree(members.filter((m) => m.name.trim())), [members]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const updateMember = (id: string, patch: Partial<OrgChartMember>) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m, ...patch };
        if (
          patch.managerId &&
          (patch.managerId === id || isDescendantMember(prev, patch.managerId, id))
        ) {
          return m;
        }
        return next;
      }),
    );
  };

  const addMember = () => setMembers((prev) => [...prev, emptyOrgMember()]);

  const removeMember = (id: string) => {
    setMembers((prev) =>
      prev
        .filter((m) => m.id !== id)
        .map((m) => (m.managerId === id ? { ...m, managerId: null } : m)),
    );
  };

  const saveOrgChart = async () => {
    if (!activeProfileId) return;
    setSaving(true);
    try {
      const cleaned = members.map((m) => ({
        ...m,
        name: m.name.trim(),
        role: m.role.trim(),
        department: m.department.trim(),
      }));
      await setDoc(
        adminDoc('workbook_profiles', activeProfileId),
        { orgChart: { members: cleaned, updatedAt: new Date().toISOString() } },
        { merge: true },
      );
      showToast('Org chart saved to SOW profile.');
    } finally {
      setSaving(false);
    }
  };

  const syncToPortal = async () => {
    if (!activeProfileId) return;
    setSyncing(true);
    try {
      await saveOrgChart();
      const snap = await getDoc(adminDoc('workbook_profiles', activeProfileId));
      const profile = { id: activeProfileId, ...snap.data() } as WorkbookProfile;
      const code = await syncProfileToPortalIfExists(profile, { syncOrgChart: true });
      showToast(
        code
          ? `Synced org chart to client portal (${code}).`
          : 'Saved profile — no linked portal found for this SOW.',
      );
    } finally {
      setSyncing(false);
    }
  };

  const managerOptions = (memberId: string) =>
    members.filter(
      (m) => m.id !== memberId && m.name.trim() && !isDescendantMember(members, memberId, m.id),
    );

  return (
    <div>
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-brandTeal-600 text-white px-4 py-3 rounded-lg shadow-2xl font-bold text-xs">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Org Chart</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Build the client organization structure for each SOW profile — name, role, department, and reporting lines.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveOrgChart}
            disabled={!activeProfileId || saving}
            className="px-4 py-2 bg-brandNavy-800 hover:bg-brandNavy-750 text-slate-200 border border-brandNavy-700 font-bold rounded text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={syncToPortal}
            disabled={!activeProfileId || syncing}
            className="px-4 py-2 bg-brandTeal-500 hover:bg-brandTeal-600 text-brandNavy-955 font-bold rounded text-sm disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Save & Sync Portal'}
          </button>
        </div>
      </div>

      <div className="glass-panel p-4 mb-6">
        <label className="text-xs text-slate-500 uppercase font-bold block mb-2">SOW Profile</label>
        <select
          value={activeProfileId ?? ''}
          onChange={(e) => setActiveProfileId(e.target.value || null)}
          className="w-full max-w-xl bg-brandNavy-900 border border-brandNavy-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brandTeal-500"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {getClientDisplayName(p)}
              {p.quoteId ? ` · ${p.quoteId}` : ''}
            </option>
          ))}
        </select>
        {activeProfile && resolvePortalAccessCode(activeProfile) && (
          <p className="text-[11px] text-slate-500 mt-2">
            Portal access code: <span className="font-mono text-brandTeal-400">{resolvePortalAccessCode(activeProfile)}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6">
        <div className="glass-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-brandNavy-800 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-200">Team roster</h2>
            <button
              type="button"
              onClick={addMember}
              className="px-3 py-1.5 bg-brandTeal-500/15 text-brandTeal-300 border border-brandTeal-500/30 rounded text-xs font-bold uppercase"
            >
              + Add person
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brandNavy-900/60 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Direct manager</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {members.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm italic">
                      No team members yet. Add the first person to start the org chart.
                    </td>
                  </tr>
                )}
                {members.map((member) => (
                  <tr key={member.id} className="border-t border-brandNavy-800/70">
                    <td className="px-3 py-2">
                      <input
                        value={member.name}
                        onChange={(e) => updateMember(member.id, { name: e.target.value })}
                        placeholder="Full name"
                        className="w-full min-w-[8rem] bg-brandNavy-950 border border-brandNavy-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-brandTeal-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={member.role}
                        onChange={(e) => updateMember(member.id, { role: e.target.value })}
                        placeholder="Job title"
                        className="w-full min-w-[7rem] bg-brandNavy-950 border border-brandNavy-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-brandTeal-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={member.department}
                        onChange={(e) => updateMember(member.id, { department: e.target.value })}
                        placeholder="Department"
                        className="w-full min-w-[7rem] bg-brandNavy-950 border border-brandNavy-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-brandTeal-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={member.managerId ?? ''}
                        onChange={(e) =>
                          updateMember(member.id, { managerId: e.target.value || null })
                        }
                        className="w-full min-w-[8rem] bg-brandNavy-950 border border-brandNavy-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-brandTeal-500"
                      >
                        <option value="">— None —</option>
                        {managerOptions(member.id).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        className="text-rose-400 hover:text-rose-300 text-xs font-bold uppercase"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel p-4">
          <h2 className="text-sm font-bold text-slate-200 mb-1">Reporting preview</h2>
          <p className="text-[11px] text-slate-500 mb-4">Auto-generated from direct manager links.</p>
          {tree.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Add named team members to preview the hierarchy.</p>
          ) : (
            <div className="space-y-1 max-h-[32rem] overflow-y-auto pr-1">
              {tree.map((node) => (
                <OrgTreeNode key={node.id} node={node} />
              ))}
            </div>
          )}
          {members.some((m) => m.name.trim()) && (
            <div className="mt-4 pt-4 border-t border-brandNavy-800">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Flat summary</p>
              <ul className="text-xs text-slate-400 space-y-1">
                {members
                  .filter((m) => m.name.trim())
                  .map((m) => (
                    <li key={m.id}>
                      <span className="text-slate-200 font-semibold">{m.name}</span>
                      {m.role ? ` — ${m.role}` : ''}
                      {m.department ? ` (${m.department})` : ''}
                      {m.managerId ? ` → reports to ${managerName(members, m.managerId)}` : ''}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
