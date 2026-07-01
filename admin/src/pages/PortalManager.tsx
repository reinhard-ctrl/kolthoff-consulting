import { useEffect, useState } from 'react';
import { deleteDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { adminCol, adminDoc } from '../lib/firebase';

interface ClientMetrics {
  annualLeakageIdentified: number;
  chaosTaxEliminated: number;
  saasSavingsIdentified: number;
}

interface ArrayItem {
  id?: number;
  [key: string]: string | number | undefined;
}

interface ClientPortal {
  companyName: string;
  repName: string;
  sowReference: string;
  currentPhase: string;
  progressPercentage: number;
  metrics: ClientMetrics;
  actionItems: ArrayItem[];
  roadmap: ArrayItem[];
  assets: ArrayItem[];
  contracts: ArrayItem[];
}

interface WorkbookProfile {
  id: string;
  clientCompany?: string;
  clientRep?: string;
  quoteId?: string;
  annualOperationalLeakage?: number;
}

function emptyClient(code: string): ClientPortal {
  return {
    companyName: 'New Client Corp',
    repName: 'Representative Name',
    sowReference: code,
    currentPhase: 'MOD 1: Business Leak Scan',
    progressPercentage: 0,
    metrics: { annualLeakageIdentified: 0, chaosTaxEliminated: 0, saasSavingsIdentified: 0 },
    actionItems: [],
    roadmap: [],
    assets: [],
    contracts: [],
  };
}

export default function PortalManager() {
  const [clients, setClients] = useState<Record<string, ClientPortal>>({});
  const [profiles, setProfiles] = useState<WorkbookProfile[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClientPortal | null>(null);
  const [editingCode, setEditingCode] = useState(false);
  const [newCodeInput, setNewCodeInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubs = [
      onSnapshot(adminCol('clients'), (snap) => {
        const data: Record<string, ClientPortal> = {};
        snap.forEach((d) => { data[d.id] = d.data() as ClientPortal; });
        setClients(data);
      }),
      onSnapshot(adminCol('workbook_profiles'), (snap) => {
        const list: WorkbookProfile[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as WorkbookProfile));
        setProfiles(list);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const selectClient = (code: string) => {
    setActiveCode(code);
    const data = clients[code];
    if (data) {
      setDraft({
        ...data,
        actionItems: data.actionItems || [],
        roadmap: data.roadmap || [],
        assets: data.assets || [],
        contracts: data.contracts || [],
        metrics: data.metrics || { annualLeakageIdentified: 0, chaosTaxEliminated: 0, saasSavingsIdentified: 0 },
      });
    }
  };

  const importProfile = async (profileId: string) => {
    if (!profileId) return;
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    const newCode = profile.quoteId || `CLIENT-${Date.now()}`;
    if (clients[newCode]) {
      showToast('Portal for this SOW already exists.');
      selectClient(newCode);
      return;
    }
    const newClient: ClientPortal = {
      companyName: profile.clientCompany || 'New Client',
      repName: profile.clientRep || 'Representative',
      sowReference: profile.quoteId || newCode,
      currentPhase: 'MOD 1: Business Leak Scan',
      progressPercentage: 0,
      metrics: {
        annualLeakageIdentified: profile.annualOperationalLeakage || 0,
        chaosTaxEliminated: 0,
        saasSavingsIdentified: 0,
      },
      actionItems: [],
      roadmap: [],
      assets: [],
      contracts: [],
    };
    await setDoc(adminDoc('clients', newCode), newClient);
    setActiveCode(newCode);
    setDraft(newClient);
    showToast('Client portal generated from SOW.');
  };

  const addClient = async () => {
    const newCode = `CLIENT-${Math.floor(Math.random() * 10000)}`;
    const newClient = emptyClient(newCode);
    await setDoc(adminDoc('clients', newCode), newClient);
    setActiveCode(newCode);
    setDraft(newClient);
    showToast('New blank portal created.');
  };

  const saveDraft = async () => {
    if (!activeCode || !draft) return;
    setSaving(true);
    try {
      await setDoc(adminDoc('clients', activeCode), draft);
      showToast('Changes synced to client portal.');
    } finally {
      setSaving(false);
    }
  };

  const saveAccessCode = async () => {
    const cleanCode = newCodeInput.trim().toUpperCase();
    if (!cleanCode || cleanCode === activeCode || !draft) {
      setEditingCode(false);
      return;
    }
    if (clients[cleanCode]) {
      showToast('Access code already in use.');
      return;
    }
    setSaving(true);
    try {
      const updated = { ...draft, sowReference: cleanCode };
      await setDoc(adminDoc('clients', cleanCode), updated);
      await deleteDoc(adminDoc('clients', activeCode!));
      setActiveCode(cleanCode);
      setDraft(updated);
      setEditingCode(false);
      showToast('Access code updated.');
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async () => {
    if (!deleteConfirm) return;
    await deleteDoc(adminDoc('clients', deleteConfirm));
    if (activeCode === deleteConfirm) {
      setActiveCode(null);
      setDraft(null);
    }
    setDeleteConfirm(null);
    showToast('Portal deleted.');
  };

  const updateDraft = (field: keyof ClientPortal, value: unknown) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateMetric = (key: keyof ClientMetrics, value: string) => {
    setDraft((prev) => prev ? { ...prev, metrics: { ...prev.metrics, [key]: Number(value) } } : prev);
  };

  const updateArray = (arrayName: keyof ClientPortal, index: number, field: string, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const arr = [...(prev[arrayName] as ArrayItem[])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, [arrayName]: arr };
    });
  };

  const addArrayItem = (arrayName: keyof ClientPortal, template: ArrayItem) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const arr = prev[arrayName] as ArrayItem[];
      return { ...prev, [arrayName]: [...arr, { id: Date.now(), ...template }] };
    });
  };

  const removeArrayItem = (arrayName: keyof ClientPortal, index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const arr = [...(prev[arrayName] as ArrayItem[])];
      arr.splice(index, 1);
      return { ...prev, [arrayName]: arr };
    });
  };

  return (
    <div className="relative">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-brandTeal-500 text-brandNavy-955 px-4 py-2 rounded shadow-lg font-bold text-sm">
          {toast}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-xl max-w-sm text-center">
            <h3 className="font-bold mb-2">Delete Client Portal?</h3>
            <p className="text-xs text-slate-400 mb-4">Permanently erase <strong className="text-rose-400">{deleteConfirm}</strong></p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-brandNavy-800 rounded text-sm">Cancel</button>
              <button onClick={deleteClient} className="px-4 py-2 bg-rose-600 rounded text-sm font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 min-h-[70vh]">
        <aside className="lg:w-72 shrink-0 glass-panel p-4 flex flex-col">
          <h2 className="text-sm font-bold text-brandTeal-400 mb-1">Portal Manager</h2>
          <p className="text-xs text-slate-500 mb-4">{Object.keys(clients).length} active portals</p>

          <select
            onChange={(e) => importProfile(e.target.value)}
            defaultValue=""
            className="w-full bg-brandNavy-800 border border-brandTeal-500/30 rounded p-2 text-xs mb-4"
          >
            <option value="">+ Import SOW from Planner</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.clientCompany} ({p.quoteId})</option>
            ))}
          </select>

          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {Object.entries(clients).map(([code, data]) => (
              <button
                key={code}
                onClick={() => selectClient(code)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${activeCode === code ? 'bg-brandNavy-800 border-brandTeal-500/50' : 'border-transparent hover:bg-brandNavy-800/50'}`}
              >
                <div className="font-bold text-sm truncate">{data.companyName}</div>
                <div className="text-[10px] text-brandTeal-400 font-mono flex justify-between mt-1">
                  <span>{code}</span>
                  <span>{data.progressPercentage || 0}%</span>
                </div>
              </button>
            ))}
          </div>

          <button onClick={addClient} className="w-full py-2 border border-dashed border-brandNavy-700 rounded text-xs text-slate-400 hover:text-white">
            + Blank Portal
          </button>
        </aside>

        <main className="flex-1 min-w-0">
          {draft && activeCode ? (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-start gap-4 border-b border-brandNavy-800 pb-4">
                <div>
                  <h1 className="text-2xl font-bold">{draft.companyName}</h1>
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    <span className="text-slate-400">Access code:</span>
                    {editingCode ? (
                      <>
                        <input
                          value={newCodeInput}
                          onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
                          className="bg-brandNavy-800 border border-brandTeal-500 rounded px-2 py-1 font-mono text-sm"
                        />
                        <button onClick={saveAccessCode} className="text-brandTeal-400 text-xs">Save</button>
                        <button onClick={() => setEditingCode(false)} className="text-slate-500 text-xs">Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-brandTeal-400 font-bold">{activeCode}</span>
                        <button onClick={() => { setNewCodeInput(activeCode); setEditingCode(true); }} className="text-slate-500 text-xs underline">Change</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteConfirm(activeCode)} className="px-3 py-2 text-rose-400 text-xs">Delete</button>
                  <button onClick={saveDraft} disabled={saving} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm">
                    {saving ? 'Saving...' : 'Save to Cloud'}
                  </button>
                </div>
              </div>

              <section className="glass-panel p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-400">General Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input value={draft.companyName} onChange={(e) => updateDraft('companyName', e.target.value)} placeholder="Company" className="bg-brandNavy-800 border border-brandNavy-700 rounded p-2 text-sm" />
                  <input value={draft.repName} onChange={(e) => updateDraft('repName', e.target.value)} placeholder="Representative" className="bg-brandNavy-800 border border-brandNavy-700 rounded p-2 text-sm" />
                  <input value={draft.sowReference} onChange={(e) => updateDraft('sowReference', e.target.value)} placeholder="SOW Reference" className="bg-brandNavy-800 border border-brandNavy-700 rounded p-2 text-sm font-mono" />
                </div>
              </section>

              <section className="glass-panel p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-400">Progress & ROI Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={draft.currentPhase} onChange={(e) => updateDraft('currentPhase', e.target.value)} placeholder="Current Phase" className="bg-brandNavy-800 border border-brandNavy-700 rounded p-2 text-sm" />
                  <input type="number" min={0} max={100} value={draft.progressPercentage} onChange={(e) => updateDraft('progressPercentage', Number(e.target.value))} placeholder="Progress %" className="bg-brandNavy-800 border border-brandNavy-700 rounded p-2 text-sm" />
                  <input type="number" value={draft.metrics.annualLeakageIdentified} onChange={(e) => updateMetric('annualLeakageIdentified', e.target.value)} placeholder="Chaos Tax Risk" className="bg-brandNavy-800 border border-brandNavy-700 rounded p-2 text-sm" />
                  <input type="number" value={draft.metrics.chaosTaxEliminated} onChange={(e) => updateMetric('chaosTaxEliminated', e.target.value)} placeholder="Chaos Tax Eliminated" className="bg-brandNavy-800 border border-brandNavy-700 rounded p-2 text-sm" />
                  <input type="number" value={draft.metrics.saasSavingsIdentified} onChange={(e) => updateMetric('saasSavingsIdentified', e.target.value)} placeholder="SaaS Savings" className="bg-brandNavy-800 border border-brandNavy-700 rounded p-2 text-sm md:col-span-2" />
                </div>
              </section>

              {(['assets', 'roadmap', 'actionItems', 'contracts'] as const).map((section) => {
                const labels: Record<string, string> = {
                  assets: 'Vault Links',
                  roadmap: 'Strategic Roadmap',
                  actionItems: 'Client Action Items',
                  contracts: 'Contracts & Billing',
                };
                const templates: Record<string, ArrayItem> = {
                  assets: { title: 'New File', category: 'MOD 1', date: 'TBD', type: 'pdf', gDriveLink: 'https://drive.google.com/...' },
                  roadmap: { title: 'New Milestone', status: 'pending', date: 'TBD', details: '...' },
                  actionItems: { title: 'New Action', desc: '...', type: 'upload', status: 'pending' },
                  contracts: { title: 'New Contract', date: 'TBD', status: 'Pending', link: '' },
                };
                const items = draft[section] as ArrayItem[];
                return (
                  <section key={section} className="glass-panel p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold uppercase text-slate-400">{labels[section]}</h3>
                      <button onClick={() => addArrayItem(section, templates[section])} className="text-xs bg-brandNavy-800 px-2 py-1 rounded">+ Add</button>
                    </div>
                    {items.map((item, idx) => (
                      <div key={item.id ?? idx} className="flex flex-wrap gap-2 items-center bg-brandNavy-950 p-3 rounded border border-brandNavy-800">
                        {Object.keys(templates[section]).filter((k) => k !== 'id').map((field) => (
                          <input
                            key={field}
                            value={String(item[field] ?? '')}
                            onChange={(e) => updateArray(section, idx, field, e.target.value)}
                            placeholder={field}
                            className="flex-1 min-w-[120px] bg-brandNavy-900 border border-brandNavy-700 rounded px-2 py-1 text-xs"
                          />
                        ))}
                        <button onClick={() => removeArrayItem(section, idx)} className="text-red-400 text-xs px-2">Remove</button>
                      </div>
                    ))}
                    {items.length === 0 && <p className="text-xs text-slate-500 italic">None configured.</p>}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-500 flex-col gap-2">
              <p className="font-bold">No portal selected</p>
              <p className="text-sm">Select a client or import from the SOW Planner.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
