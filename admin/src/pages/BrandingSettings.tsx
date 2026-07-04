import { useRef, useState } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app, adminAppId } from '../lib/firebase';
import { useTenantBranding } from '../hooks/useTenantBranding';
import { splitCompanyDisplay, type TenantBrandingConfig } from '../lib/tenant-branding';

const storage = getStorage(app);

export default function BrandingSettings() {
  const { branding, loading, saving, saveBranding } = useTenantBranding();
  const [draft, setDraft] = useState<TenantBrandingConfig | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = draft ?? branding;

  const update = (patch: Partial<TenantBrandingConfig>) => {
    setDraft((d) => ({ ...(d ?? branding), ...patch }));
    setMessage('');
  };

  const handleSave = async () => {
    setMessage('');
    await saveBranding(active);
    setDraft(null);
    setMessageOk(true);
    setMessage('Branding saved. Refresh CRM and Estimates tabs to see updates.');
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
      const path = `artifacts/${adminAppId}/files/branding/logo.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      update({ logoUrl: url });
      setMessageOk(true);
      setMessage('Logo uploaded. Click Save to apply.');
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
    <div className="ops-main-inner max-w-2xl">
      <header className="ops-page-header mb-6">
        <h1>Company Branding</h1>
        <p>Customize how your agency appears across CRM, Estimates, and Collections.</p>
      </header>

      <div className="ops-card glass-panel p-6 sm:p-8 space-y-6">
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
              <img
                src={active.logoUrl}
                alt="Logo preview"
                className="h-12 w-auto object-contain"
              />
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

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="ops-btn-primary brand-primary-bg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save branding'}
          </button>
          {draft && (
            <button type="button" onClick={() => setDraft(null)} className="ops-btn-secondary">
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
