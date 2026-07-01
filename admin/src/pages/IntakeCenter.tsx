import { useEffect, useMemo, useState } from 'react';
import { deleteDoc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { adminCol, adminDoc } from '../lib/firebase';
import { getClientDisplayName, INTAKE_MAPPED_TARGETS } from '../lib/engagement-config';
import { intakeTargetLabel, isValidIntakeTarget, mergeIntakeResponses } from '../lib/intake-merge';
import { buildPortalPatchFromProfile, resolvePortalAccessCode, type PortalClientRecord } from '../lib/portal-sync';

interface IntakeField {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
}

interface IntakeTemplate {
  id: string;
  title: string;
  description: string;
  mappedTarget: string;
  fields: IntakeField[];
  isCustom?: boolean;
}

interface WorkbookProfile {
  id: string;
  clientCompany?: string;
  clientName?: string;
  clientRep?: string;
  quoteId?: string;
  links?: { portalClientId?: string };
  subSaaS?: Record<string, unknown>[];
  roles?: Record<string, unknown>[];
  customAssets?: Record<string, unknown>[];
}

interface IntakeForm {
  id: string;
  profileId: string;
  title: string;
  description?: string;
  mappedTarget: string;
  fields: IntakeField[];
  responses: Record<string, string | number>[];
  status: string;
  createdAt: string;
}

interface BuilderField {
  id: number;
  label: string;
  type: string;
  placeholder: string;
}

const BUILTIN_TEMPLATES: IntakeTemplate[] = [
  {
    id: 'tmpl-saas',
    title: 'Software & SaaS Inventory',
    description: 'Please list all the software tools, subscriptions, and digital services your company currently pays for.',
    mappedTarget: 'subSaaS',
    fields: [
      { name: 'tool', label: 'Software / Tool Name', type: 'text', placeholder: 'e.g., Zoom, HubSpot' },
      { name: 'billing', label: 'Monthly Cost (PHP)', type: 'number', placeholder: 'e.g., 1400' },
      { name: 'users', label: 'Active Users/Seats', type: 'number', placeholder: 'e.g., 5' },
      { name: 'reason', label: 'Primary Use Case', type: 'text', placeholder: 'e.g., Video calls' },
    ],
  },
  {
    id: 'tmpl-roster',
    title: 'Employee Roster & Roles',
    description: 'Please provide a basic list of your active team members to map the current organization chart.',
    mappedTarget: 'roles',
    fields: [
      { name: 'owner', label: 'Employee Name', type: 'text', placeholder: 'e.g., Juan Dela Cruz' },
      { name: 'role', label: 'Job Title / Position', type: 'text', placeholder: 'e.g., Warehouse Manager' },
    ],
  },
];

export default function IntakeCenter() {
  const [view, setView] = useState<'dashboard' | 'builder' | 'review'>('dashboard');
  const [profiles, setProfiles] = useState<WorkbookProfile[]>([]);
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [customTemplates, setCustomTemplates] = useState<IntakeTemplate[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [builderTitle, setBuilderTitle] = useState('');
  const [builderDesc, setBuilderDesc] = useState('');
  const [builderTarget, setBuilderTarget] = useState('customAssets');
  const [builderFields, setBuilderFields] = useState<BuilderField[]>([]);

  useEffect(() => {
    const unsubs = [
      onSnapshot(adminCol('workbook_profiles'), (snap) => {
        const list: WorkbookProfile[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as WorkbookProfile));
        setProfiles(list);
        if (list.length && !selectedProfileId) setSelectedProfileId(list[0].id);
      }),
      onSnapshot(adminCol('intake_forms'), (snap) => {
        const list: IntakeForm[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as IntakeForm));
        setForms(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
      }),
      onSnapshot(adminCol('intake_templates'), (snap) => {
        const list: IntakeTemplate[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as IntakeTemplate));
        setCustomTemplates(list);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [selectedProfileId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const allTemplates = useMemo(() => [...BUILTIN_TEMPLATES, ...customTemplates], [customTemplates]);
  const activeForm = useMemo(() => forms.find((f) => f.id === activeFormId), [forms, activeFormId]);
  const activeProfile = useMemo(
    () => (activeForm ? profiles.find((p) => p.id === activeForm.profileId) : null),
    [activeForm, profiles]
  );

  const createIntakeRequest = async (profileId: string, template: IntakeTemplate) => {
    if (!profileId) return;
    const formId = `intake-${Date.now()}`;
    const newForm: IntakeForm = {
      id: formId,
      profileId,
      title: template.title,
      description: template.description,
      mappedTarget: template.mappedTarget,
      fields: template.fields,
      responses: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await setDoc(adminDoc('intake_forms', formId), newForm);
    showToast('Intake request generated.');
  };

  const deleteIntakeRequest = async (formId: string) => {
    await deleteDoc(adminDoc('intake_forms', formId));
    if (activeFormId === formId) {
      setActiveFormId(null);
      setView('dashboard');
    }
  };

  const copyLink = (formId: string) => {
    const url = `${window.location.origin}/apps/public/client_intake.html?form=${formId}`;
    navigator.clipboard.writeText(url);
    showToast('Client intake link copied!');
  };

  const saveCustomTemplate = async () => {
    if (!builderTitle.trim() || builderFields.length === 0) return;
    if (!isValidIntakeTarget(builderTarget)) {
      showToast('Invalid mapping target.');
      return;
    }
    setSyncing(true);
    try {
      const cleanFields = builderFields.map((f, i) => ({
        name: f.label.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || `field_${i}`,
        label: f.label || `Field ${i + 1}`,
        type: f.type,
        placeholder: f.placeholder,
      }));
      const tmplId = `tmpl-${Date.now()}`;
      await setDoc(adminDoc('intake_templates', tmplId), {
        title: builderTitle,
        description: builderDesc,
        mappedTarget: builderTarget,
        fields: cleanFields,
        isCustom: true,
        createdAt: new Date().toISOString(),
      });
      showToast('Custom template saved!');
      setView('dashboard');
      setBuilderTitle('');
      setBuilderDesc('');
      setBuilderFields([]);
    } finally {
      setSyncing(false);
    }
  };

  const syncToDeliverySuite = async () => {
    if (!activeForm || !activeProfile) return;
    if (!isValidIntakeTarget(activeForm.mappedTarget)) {
      showToast('Invalid mapping target — cannot sync.');
      return;
    }
    setSyncing(true);
    try {
      const profileRef = adminDoc('workbook_profiles', activeProfile.id);
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) return;

      const profileData = profileSnap.data() as WorkbookProfile;
      const target = activeForm.mappedTarget;

      const formattedResponses = activeForm.responses.map((r) => {
        const formatted = { ...r };
        activeForm.fields.forEach((f) => {
          if (f.type === 'number') formatted[f.name] = Number(formatted[f.name]) || 0;
        });
        return formatted;
      });

      const existingRows = (profileData[target as keyof WorkbookProfile] as Record<string, unknown>[] | undefined) || [];
      const merged = mergeIntakeResponses(existingRows, formattedResponses, target);
      const updatedProfile = { ...profileData, [target]: merged };

      await setDoc(profileRef, { [target]: merged }, { merge: true });

      const portalCode = resolvePortalAccessCode(updatedProfile);
      if (portalCode) {
        const portalRef = adminDoc('clients', portalCode);
        const portalSnap = await getDoc(portalRef);
        if (portalSnap.exists()) {
          const portalPatch = buildPortalPatchFromProfile(updatedProfile, portalSnap.data() as PortalClientRecord, {
            syncIntakeAssets: target === 'subSaaS' || target === 'customAssets',
          });
          await setDoc(portalRef, portalPatch, { merge: true });
        }
      }

      await setDoc(adminDoc('intake_forms', activeForm.id), { status: 'synced' }, { merge: true });
      showToast(
        portalCode
          ? `Synced into ${intakeTargetLabel(target)} and updated client portal (${portalCode}).`
          : `Synced ${formattedResponses.length} row(s) into ${intakeTargetLabel(target)}.`,
      );
      setView('dashboard');
    } finally {
      setSyncing(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'pending') return <span className="text-amber-400 text-xs uppercase font-bold">Pending</span>;
    if (status === 'completed') return <span className="text-brandTeal-400 text-xs uppercase font-bold">Ready</span>;
    if (status === 'synced') return <span className="text-emerald-400 text-xs uppercase font-bold">Synced</span>;
    return <span className="text-slate-500 text-xs uppercase">{status}</span>;
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-brandTeal-600 text-white px-4 py-3 rounded-lg shadow-2xl font-bold text-xs">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Intake Center</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView('dashboard')}
            className={`px-3 py-1.5 rounded text-sm ${view === 'dashboard' ? 'bg-brandTeal-500 text-brandNavy-955 font-bold' : 'bg-brandNavy-800 text-slate-400'}`}
          >
            Active Forms
          </button>
          <button
            onClick={() => setView('builder')}
            className={`px-3 py-1.5 rounded text-sm ${view === 'builder' ? 'bg-brandTeal-500 text-brandNavy-955 font-bold' : 'bg-brandNavy-800 text-slate-400'}`}
          >
            Template Builder
          </button>
        </div>
      </div>

      <div className="glass-panel p-4 mb-6">
        <h2 className="text-sm font-bold text-slate-400 uppercase mb-3">Launch New Form</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Target Client</label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="bg-brandNavy-800 border border-brandNavy-700 rounded p-2 text-sm min-w-[200px]"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{getClientDisplayName(p)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {allTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => createIntakeRequest(selectedProfileId, tmpl)}
                disabled={!selectedProfileId}
                className="px-3 py-2 bg-brandNavy-800 border border-brandNavy-700 hover:border-brandTeal-500/50 rounded text-xs text-left"
              >
                <div className="font-bold">{tmpl.title}</div>
                <div className="text-slate-500 font-mono text-[10px]">Maps: {intakeTargetLabel(tmpl.mappedTarget)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'dashboard' && (
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-4">Client</th>
                <th className="p-4">Form</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brandNavy-800">
              {forms.map((form) => {
                const client = profiles.find((p) => p.id === form.profileId);
                return (
                  <tr key={form.id} className="hover:bg-brandNavy-800/30">
                    <td className="p-4 font-bold">{client ? getClientDisplayName(client) : 'Unknown'}</td>
                    <td className="p-4">
                      <div className="font-bold">{form.title}</div>
                      <div className="text-xs text-slate-500 font-mono">Maps: {intakeTargetLabel(form.mappedTarget)}</div>
                    </td>
                    <td className="p-4">{statusBadge(form.status)}</td>
                    <td className="p-4 text-right space-x-2">
                      {form.status === 'pending' && (
                        <button onClick={() => copyLink(form.id)} className="px-3 py-1 bg-brandNavy-800 rounded text-xs">
                          Copy Link
                        </button>
                      )}
                      {form.status === 'completed' && (
                        <button
                          onClick={() => { setActiveFormId(form.id); setView('review'); }}
                          className="px-3 py-1 bg-brandTeal-500 text-brandNavy-955 rounded text-xs font-bold"
                        >
                          Review & Sync
                        </button>
                      )}
                      <button onClick={() => deleteIntakeRequest(form.id)} className="px-2 py-1 text-red-400 text-xs">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {forms.length === 0 && <p className="p-6 text-slate-500 italic">No intake forms yet.</p>}
        </div>
      )}

      {view === 'builder' && (
        <div className="glass-panel p-6 space-y-6 border-t-4 border-brandTeal-500">
          <input
            value={builderTitle}
            onChange={(e) => setBuilderTitle(e.target.value)}
            placeholder="Template Title *"
            className="w-full bg-brandNavy-800 border border-brandNavy-700 rounded p-3 text-sm"
          />
          <textarea
            value={builderDesc}
            onChange={(e) => setBuilderDesc(e.target.value)}
            placeholder="Client Instructions..."
            rows={2}
            className="w-full bg-brandNavy-800 border border-brandNavy-700 rounded p-3 text-sm resize-none"
          />
          <select
            value={builderTarget}
            onChange={(e) => setBuilderTarget(e.target.value)}
            className="w-full bg-brandNavy-800 border border-brandNavy-700 rounded p-3 text-sm"
          >
            {INTAKE_MAPPED_TARGETS.map((target) => (
              <option key={target} value={target}>{intakeTargetLabel(target)}</option>
            ))}
          </select>
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-brandTeal-400 uppercase">Fields</h3>
              <button
                onClick={() => setBuilderFields([...builderFields, { id: Date.now(), label: '', type: 'text', placeholder: '' }])}
                className="text-xs bg-brandNavy-800 px-3 py-1.5 rounded"
              >
                + Add Field
              </button>
            </div>
            <div className="space-y-3">
              {builderFields.map((field) => (
                <div key={field.id} className="flex gap-3 bg-brandNavy-950 p-4 rounded border border-brandNavy-800">
                  <input
                    value={field.label}
                    onChange={(e) => setBuilderFields(builderFields.map((f) => f.id === field.id ? { ...f, label: e.target.value } : f))}
                    placeholder="Field Label"
                    className="flex-1 bg-brandNavy-900 border border-brandNavy-700 rounded p-2 text-xs"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => setBuilderFields(builderFields.map((f) => f.id === field.id ? { ...f, type: e.target.value } : f))}
                    className="bg-brandNavy-900 border border-brandNavy-700 rounded p-2 text-xs"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                  </select>
                  <button
                    onClick={() => setBuilderFields(builderFields.filter((f) => f.id !== field.id))}
                    className="text-red-400 text-xs px-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setView('dashboard')} className="px-4 py-2 bg-brandNavy-800 rounded text-sm">Cancel</button>
            <button onClick={saveCustomTemplate} disabled={syncing} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 font-bold rounded text-sm">
              Save Template
            </button>
          </div>
        </div>
      )}

      {view === 'review' && activeForm && (
        <div className="space-y-6">
          <div className="glass-panel p-6 flex justify-between items-center border-l-4 border-brandTeal-500">
            <div>
              <h2 className="text-lg font-bold">{activeForm.title}</h2>
              <p className="text-sm text-slate-400 mt-1">
                Submitted by <strong className="text-white">{activeProfile ? getClientDisplayName(activeProfile) : 'Unknown'}</strong>
              </p>
            </div>
            {activeForm.status === 'completed' && (
              <button
                onClick={syncToDeliverySuite}
                disabled={syncing}
                className="px-6 py-2 bg-brandTeal-500 text-brandNavy-955 font-bold rounded text-sm"
              >
                {syncing ? 'Syncing...' : 'Map to Delivery Suite'}
              </button>
            )}
          </div>
          <div className="glass-panel overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
                <tr>
                  {activeForm.fields.map((f) => <th key={f.name} className="p-4">{f.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-brandNavy-800">
                {activeForm.responses.map((row, i) => (
                  <tr key={i}>
                    {activeForm.fields.map((f) => <td key={f.name} className="p-4">{row[f.name]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => setView('dashboard')} className="text-sm text-brandTeal-400 underline">
            ← Back to forms
          </button>
        </div>
      )}
    </div>
  );
}
