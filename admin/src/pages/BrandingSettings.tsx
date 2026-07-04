import { useProduct } from '../lib/product-context';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app, adminAppId } from '../lib/firebase';
import { useTenantBranding } from '../hooks/useTenantBranding';
import {
  presetToConfig,
  splitCompanyDisplay,
  type TenantBrandingConfig,
} from '../lib/tenant-branding';

const storage = getStorage(app);

export default function BrandingSettings() {
  const product = useProduct();
  const modules = product.moduleLabels;
  const {
    branding,
    presets,
    activePresetId,
    loading,
    saving,
    saveBranding,
    savePreset,
    applyPreset,
    deletePreset,
  } = useTenantBranding();

  const [draft, setDraft] = useState<TenantBrandingConfig | null>(null);
  const [editorPresetId, setEditorPresetId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  const active = draft ?? branding;
  const editingPreset = editorPresetId ? presets.find((p) => p.id === editorPresetId) : null;

  useEffect(() => {
    if (loading || initialized.current) return;
    initialized.current = true;
    if (activePresetId && presets.some((p) => p.id === activePresetId)) {
      const preset = presets.find((p) => p.id === activePresetId);
      if (preset) {
        setEditorPresetId(activePresetId);
        setDraft(presetToConfig(preset));
        setProfileName(preset.name);
      }
    } else {
      setProfileName(branding.companyName);
    }
  }, [loading, activePresetId, presets, branding]);

  const update = (patch: Partial<TenantBrandingConfig>) => {
    setDraft((d) => ({ ...(d ?? branding), ...patch }));
    setMessage('');
  };

  const loadPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setEditorPresetId(presetId);
    setDraft(presetToConfig(preset));
    setProfileName(preset.name);
    setMessage('');
  };

  const startNewProfile = () => {
    setEditorPresetId(null);
    setDraft({ ...branding });
    setProfileName('');
    setMessage('');
  };

  const handleApplyToWorkspace = async () => {
    setMessage('');
    await saveBranding(active, editorPresetId);
    setDraft(null);
    setMessageOk(true);
    setMessage(`Active workspace branding updated. Refresh ${modules.sales} and ${modules.quotes} tabs.`);
  };

  const handleSaveProfile = async () => {
    const name = profileName.trim() || active.companyName.trim();
    if (!name) {
      setMessageOk(false);
      setMessage('Enter a profile name before saving.');
      return;
    }
    setMessage('');
    const id = await savePreset(name, active, editorPresetId ?? undefined);
    setEditorPresetId(id);
    setProfileName(name);
    setDraft(null);
    setMessageOk(true);
    setMessage(`Saved profile “${name}”. Click Apply to workspace when ready.`);
  };

  const handleApplyPreset = async (presetId: string) => {
    setMessage('');
    await applyPreset(presetId);
    loadPreset(presetId);
    setDraft(null);
    setMessageOk(true);
    setMessage('Profile applied to your workspace.');
  };

  const handleDeletePreset = async (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    if (!window.confirm(`Delete saved profile “${preset.name}”?`)) return;
    setMessage('');
    await deletePreset(presetId);
    if (editorPresetId === presetId) {
      setEditorPresetId(null);
      setDraft(null);
      setProfileName(branding.companyName);
    }
    setMessageOk(true);
    setMessage(`Deleted profile “${preset.name}”.`);
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessageOk(false);
      setMessage('Please choose an image file (PNG, JPG, SVG, or WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessageOk(false);
      setMessage('Logo must be under 2 MB.');
      return;
    }
    setUploading(true);
    setMessage('');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const slug = editorPresetId || 'active';
      const path = `artifacts/${adminAppId}/files/branding-${slug}/logo.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      update({ logoUrl: url });
      setMessageOk(true);
      setMessage('Logo uploaded. Save the profile to keep it.');
    } catch (err) {
      setMessageOk(false);
      setMessage(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const display = splitCompanyDisplay(active.companyName);

  if (loading) {
    return <p className="text-slate-400 animate-pulse">Loading branding…</p>;
  }

  return (
    <div className="ops-main-inner max-w-5xl">
      <header className="ops-page-header mb-6">
        <h1>Company Branding</h1>
        <p>Save multiple brand profiles for different agencies or clients, then apply one to your workspace.</p>
      </header>

      <div className="grid lg:grid-cols-[16rem,minmax(0,1fr)] gap-6 items-start">
        <aside className="ops-card glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved profiles</h2>
            <button type="button" onClick={startNewProfile} className="text-xs font-medium brand-primary-text">
              + New
            </button>
          </div>

          {presets.length === 0 ? (
            <p className="text-sm text-slate-400 leading-relaxed">
              No saved profiles yet. Edit the form and click Save profile.
            </p>
          ) : (
            <ul className="space-y-2">
              {presets.map((preset) => {
                const selected = editorPresetId === preset.id;
                const live = activePresetId === preset.id;
                return (
                  <li key={preset.id}>
                    <div
                      className={`rounded-lg border p-3 transition-colors ${
                        selected
                          ? 'border-brandTeal-500/40 bg-brandTeal-500/10'
                          : 'border-brandNavy-700 hover:border-brandNavy-700/80'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => loadPreset(preset.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: preset.primaryColor }}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-medium text-slate-900 truncate">{preset.name}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 truncate">{preset.companyName}</p>
                        {live && (
                          <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide brand-primary-text">
                            Active
                          </span>
                        )}
                      </button>
                      <div className="flex gap-2 mt-2 pt-2 border-t border-brandNavy-700/60">
                        <button
                          type="button"
                          disabled={saving || live}
                          onClick={() => handleApplyPreset(preset.id)}
                          className="text-xs font-medium brand-primary-text disabled:opacity-40"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleDeletePreset(preset.id)}
                          className="text-xs font-medium text-rose-500 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="ops-card glass-panel p-6 sm:p-8 space-y-6">
          <div>
            <label htmlFor="brand-profile-name" className="ops-form-label">Profile name</label>
            <input
              id="brand-profile-name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g. Meridian Creative"
              className="ops-input"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              {editorPresetId ? 'Updating saved profile.' : 'New profile — save before applying.'}
            </p>
          </div>

          <div>
            <label htmlFor="brand-company" className="ops-form-label">Company name</label>
            <input
              id="brand-company"
              value={active.companyName}
              onChange={(e) => update({ companyName: e.target.value })}
              placeholder="Studio North Creative"
              className="ops-input"
            />
          </div>

          <div>
            <label htmlFor="brand-tagline" className="ops-form-label">Tagline</label>
            <input
              id="brand-tagline"
              value={active.tagline ?? ''}
              onChange={(e) => update({ tagline: e.target.value })}
              placeholder="Creative & Digital Services"
              className="ops-input"
            />
          </div>

          <div>
            <label htmlFor="brand-color" className="ops-form-label">Brand color</label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                aria-label="Brand color picker"
                value={active.primaryColor}
                onChange={(e) => update({ primaryColor: e.target.value })}
                className="h-10 w-10 rounded-md cursor-pointer border border-brandNavy-700 bg-transparent p-0.5"
              />
              <input
                id="brand-color"
                value={active.primaryColor}
                onChange={(e) => update({ primaryColor: e.target.value })}
                className="ops-input flex-1 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <span className="ops-form-label">Logo</span>
            <div className="flex flex-wrap gap-3 items-start">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="ops-btn-secondary disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload logo'}
              </button>
              <input
                value={active.logoUrl ?? ''}
                onChange={(e) => update({ logoUrl: e.target.value })}
                placeholder="Or paste logo URL"
                className="ops-input flex-1 min-w-[200px] text-sm"
              />
            </div>
            {active.logoUrl && (
              <div className="mt-3 p-3 rounded-lg border border-brandNavy-700 bg-brandNavy-800/50 inline-block">
                <img src={active.logoUrl} alt="Logo preview" className="h-12 w-auto object-contain" />
              </div>
            )}
          </div>

          <div
            className="brand-preview-panel rounded-lg border p-5"
            style={{ borderColor: `${active.primaryColor}33`, backgroundColor: `${active.primaryColor}0a` }}
          >
            <p className="text-xs font-medium text-slate-500 mb-3">Preview</p>
            <div className="flex items-center gap-3">
              {active.logoUrl ? (
                <img src={active.logoUrl} alt="" className="h-10 w-auto object-contain" />
              ) : (
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-sm"
                  style={{ backgroundColor: active.primaryColor }}
                >
                  {display.line1.charAt(0)}
                </div>
              )}
              <div>
                <div className="font-semibold text-slate-900 text-sm">
                  {display.line1}
                  {display.line2 ? (
                    <span style={{ color: active.primaryColor }}> {display.line2}</span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{active.tagline}</div>
              </div>
            </div>
          </div>

          {message && (
            <p className={`ops-message ${messageOk ? 'ops-message-success' : ''}`}>{message}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveProfile}
              className="ops-btn-secondary disabled:opacity-50"
            >
              {saving ? 'Saving…' : editorPresetId ? 'Save profile' : 'Save as new profile'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleApplyToWorkspace}
              className="ops-btn-primary brand-primary-bg disabled:opacity-50"
            >
              {saving ? 'Applying…' : 'Apply to workspace'}
            </button>
            {draft && (
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  if (editorPresetId) {
                    const preset = presets.find((p) => p.id === editorPresetId);
                    if (preset) setDraft(presetToConfig(preset));
                  }
                }}
                className="ops-btn-secondary"
              >
                Reset edits
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
