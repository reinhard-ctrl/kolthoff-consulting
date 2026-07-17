import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { app, db } from '../lib/firebase';
import {
  brandingWritePayload,
  defaultWorkspaceBranding,
  normalizeWorkspaceBranding,
  type WorkspaceBrandingConfig,
} from '../lib/workspace-branding';

const storage = getStorage(app);

export default function WorkspaceBrandingPanel({
  tenantId,
  clientName,
  onSaved,
}: {
  tenantId: string;
  clientName: string;
  onSaved?: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<WorkspaceBrandingConfig>(() => defaultWorkspaceBranding(clientName));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config'));
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : null;
        setDraft(
          normalizeWorkspaceBranding(
            data?.branding as Partial<WorkspaceBrandingConfig> | undefined,
            (data?.clientName as string) || clientName,
          ),
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load branding');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, clientName]);

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    setError('');
    try {
      const branding = brandingWritePayload(draft);
      const now = Date.now();
      await setDoc(
        doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config'),
        {
          branding,
          brandingPresets: {
            default: {
              id: 'default',
              name: branding.companyName,
              ...branding,
              updatedAt: now,
            },
          },
          activeBrandingPresetId: 'default',
          clientName: branding.companyName,
          updatedAt: now,
        },
        { merge: true },
      );
      await setDoc(
        doc(db, 'artifacts', 'kolthoff-admin-app', 'public', 'data', 'core_workspaces', tenantId),
        { clientName: branding.companyName, updatedAt: now },
        { merge: true },
      );
      onSaved?.(`Branding saved for ${branding.companyName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (!tenantId || !file) return;
    setUploading(true);
    setError('');
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `artifacts/${tenantId}/files/branding-default/logo.${ext || 'png'}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const logoUrl = await getDownloadURL(storageRef);
      setDraft((d) => ({ ...d, logoUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!tenantId) {
    return <p className="text-slate-500 italic">Select a workspace instance first.</p>;
  }

  if (loading) {
    return <p className="text-slate-500">Loading branding…</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="glass-panel p-6 space-y-4">
        <div>
          <h2 className="font-bold text-white mb-1">Client branding</h2>
          <p className="text-xs text-slate-500">
            Same options as Agency Ops: company name, tagline, brand color, and logo. Shown in the client workspace chrome (no Kolthoff naming).
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase text-slate-500 block mb-1">Company name</label>
          <input
            value={draft.companyName}
            onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
            className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-slate-500 block mb-1">Tagline</label>
          <input
            value={draft.tagline}
            onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
            className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
            placeholder="Team workspace"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-slate-500 block mb-1">Brand color</label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={draft.primaryColor}
              onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
              className="h-10 w-10 rounded border border-brandNavy-700 bg-transparent p-0.5"
            />
            <input
              value={draft.primaryColor}
              onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
              className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase text-slate-500 block mb-1">Logo</label>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-2 text-xs rounded border border-brandNavy-700 text-slate-300 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : draft.logoUrl ? 'Replace logo' : 'Upload logo'}
            </button>
            {draft.logoUrl && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, logoUrl: '' })}
                className="text-xs text-rose-400"
              >
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadLogo(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={saving || !draft.companyName.trim()}
          className="px-4 py-2 rounded bg-brandTeal-500 text-brandNavy-955 font-bold text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save branding'}
        </button>
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-xs uppercase text-slate-500 mb-3">Workspace preview</h3>
        <div className="rounded-xl overflow-hidden border border-brandNavy-700 bg-[#020613]">
          <div className="flex">
            <div className="w-44 p-4 border-r border-brandNavy-800">
              {draft.logoUrl ? (
                <img src={draft.logoUrl} alt="" className="h-8 object-contain mb-3" />
              ) : (
                <div
                  className="h-8 w-8 rounded-lg mb-3 flex items-center justify-center text-[10px] font-bold text-slate-950"
                  style={{ backgroundColor: draft.primaryColor }}
                >
                  {(draft.companyName || 'W').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="text-white text-sm font-bold truncate">{draft.companyName || 'Company'}</div>
              <div className="text-[11px] text-slate-500 truncate">{draft.tagline || 'Team workspace'}</div>
              <div className="mt-4 space-y-1">
                {['Messenger', 'Approvals', 'Organization'].map((label, i) => (
                  <div
                    key={label}
                    className={`rounded-lg px-2 py-1.5 text-xs ${i === 1 ? 'text-slate-950 font-semibold' : 'text-slate-400'}`}
                    style={i === 1 ? { backgroundColor: draft.primaryColor } : undefined}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 p-5 bg-[#f3f5f8] min-h-[220px]">
              <div className="text-slate-900 font-bold text-sm mb-1">Approval Center</div>
              <div className="text-xs text-slate-500 mb-3">Branded for {draft.companyName || 'your client'}</div>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950"
                style={{ backgroundColor: draft.primaryColor }}
              >
                + New request
              </button>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Live at <code className="text-brandTeal-400">/workspace/?tenant={tenantId}</code>
        </p>
      </div>
    </div>
  );
}
