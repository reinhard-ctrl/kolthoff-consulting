import { useEffect, useState } from 'react';
import { getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { adminCol, adminDoc } from '../lib/firebase';
import { getClientDisplayName } from '../lib/engagement-config';
import DiagramEditor from '../components/DiagramEditor';
import {
  BLANK_ORG_CHART_XML,
  parseRosterFromDrawioXml,
  resolveWorkspaceOrgChartXml,
} from '../lib/diagram-editor';
import {
  emptyRosterRow,
  membersToRosterRows,
  resolveOrgChartFromProfile,
  rosterRowsToMembers,
  type OrgChartRosterRow,
} from '../lib/org-chart';
import { resolvePortalAccessCode, syncProfileToPortalIfExists } from '../lib/portal-sync';

interface WorkbookProfile {
  id: string;
  clientCompany?: string;
  clientName?: string;
  clientRep?: string;
  quoteId?: string;
  orgChart?: {
    members?: Array<{ id: string; name: string; role?: string; department?: string; managerId?: string | null }>;
    roster?: OrgChartRosterRow[];
    drawioXml?: string;
    svgCache?: string;
    updatedAt?: string;
  };
  roles?: Array<{ owner?: string; name?: string; role?: string; title?: string }>;
}

export default function OrgChart() {
  const [profiles, setProfiles] = useState<WorkbookProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [orgChartXml, setOrgChartXml] = useState(BLANK_ORG_CHART_XML);
  const [orgChartSvg, setOrgChartSvg] = useState('');
  const [roster, setRoster] = useState<OrgChartRosterRow[]>([]);
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
      setOrgChartXml(BLANK_ORG_CHART_XML);
      setOrgChartSvg('');
      setRoster([]);
      return;
    }

    const xml = resolveWorkspaceOrgChartXml(activeProfile);
    setOrgChartXml(xml);
    setOrgChartSvg(activeProfile.orgChart?.svgCache || '');

    const storedRoster = activeProfile.orgChart?.roster;
    if (storedRoster?.length) {
      setRoster(storedRoster);
      return;
    }

    const parsed = parseRosterFromDrawioXml(xml);
    if (parsed.length) {
      setRoster(parsed);
      return;
    }

    const chart = resolveOrgChartFromProfile(activeProfile);
    setRoster(membersToRosterRows(chart.members));
  }, [activeProfileId, activeProfile]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const updateRosterRow = (rowId: string, field: keyof OrgChartRosterRow, value: string) => {
    setRoster((prev) => prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  };

  const addRosterRow = () => setRoster((prev) => [...prev, emptyRosterRow()]);

  const removeRosterRow = (rowId: string) => {
    setRoster((prev) => prev.filter((row) => row.id !== rowId));
  };

  const handleParseRosterFromDiagram = () => {
    const parsed = parseRosterFromDrawioXml(orgChartXml);
    setRoster(parsed);
    showToast(`Parsed ${parsed.length} roster entries from diagram.`);
  };

  const saveOrgChart = async () => {
    if (!activeProfileId) return;
    setSaving(true);
    try {
      const members = rosterRowsToMembers(roster);
      await setDoc(
        adminDoc('workbook_profiles', activeProfileId),
        {
          orgChart: {
            drawioXml: orgChartXml,
            svgCache: orgChartSvg || undefined,
            roster,
            members,
            updatedAt: new Date().toISOString(),
          },
        },
        { merge: true },
      );
      showToast('Org chart and roster saved to SOW profile.');
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
            Build the organization chart with draw.io (same engine as Org Chart Policy). Apply the diagram, then edit the roster summary — Policy Studio can sync from this workspace.
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
            Portal access code:{' '}
            <span className="font-mono text-brandTeal-400">{resolvePortalAccessCode(activeProfile)}</span>
          </p>
        )}
      </div>

      <div className="glass-panel p-4 mb-6 min-h-[32rem]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">draw.io Organization Chart</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Use standard draw.io org chart shapes. Click Apply to capture the diagram into this workspace profile.
            </p>
          </div>
          <button
            type="button"
            onClick={handleParseRosterFromDiagram}
            className="text-[10px] font-bold uppercase bg-brandNavy-800 border border-brandNavy-700 text-brandTeal-400 px-3 py-1.5 rounded-lg hover:bg-brandNavy-750 transition-colors"
          >
            Parse Roster from Diagram
          </button>
        </div>
        <DiagramEditor
          preset="orgChart"
          xml={orgChartXml}
          onXmlChange={setOrgChartXml}
          onSvgExport={setOrgChartSvg}
          height={520}
          applyLabel="Apply Diagram to Workspace"
        />
        {orgChartSvg && (
          <div className="mt-4 pt-4 border-t border-brandNavy-800">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Diagram preview</p>
            <img src={orgChartSvg} alt="Organization chart preview" className="max-w-full h-auto border border-brandNavy-800 rounded-lg bg-white p-2" />
          </div>
        )}
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-brandNavy-800 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-slate-200">Roster Summary</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Same fields as Org Chart Policy section 4 — editable after parsing from the diagram.</p>
          </div>
          <button
            type="button"
            onClick={addRosterRow}
            className="px-3 py-1.5 bg-brandTeal-500/15 text-brandTeal-300 border border-brandTeal-500/30 rounded text-xs font-bold uppercase"
          >
            + Add Person
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brandNavy-900/60 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Reports To</th>
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {roster.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm italic">
                    No roster entries yet. Build the diagram above and click Parse Roster from Diagram, or add people manually.
                  </td>
                </tr>
              )}
              {roster.map((row) => (
                <tr key={row.id} className="border-t border-brandNavy-800/70 align-top">
                  <td className="px-3 py-2">
                    <input
                      value={row.name}
                      onChange={(e) => updateRosterRow(row.id, 'name', e.target.value)}
                      placeholder="Full name"
                      className="w-full min-w-[8rem] bg-brandNavy-950 border border-brandNavy-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-brandTeal-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.title}
                      onChange={(e) => updateRosterRow(row.id, 'title', e.target.value)}
                      placeholder="Job title"
                      className="w-full min-w-[7rem] bg-brandNavy-950 border border-brandNavy-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-brandTeal-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.department}
                      onChange={(e) => updateRosterRow(row.id, 'department', e.target.value)}
                      placeholder="Department"
                      className="w-full min-w-[7rem] bg-brandNavy-950 border border-brandNavy-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-brandTeal-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.reportsTo}
                      onChange={(e) => updateRosterRow(row.id, 'reportsTo', e.target.value)}
                      placeholder="Manager name"
                      className="w-full min-w-[8rem] bg-brandNavy-950 border border-brandNavy-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-brandTeal-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeRosterRow(row.id)}
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
    </div>
  );
}
