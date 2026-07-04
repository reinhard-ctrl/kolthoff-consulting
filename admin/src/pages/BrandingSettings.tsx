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
  const fileRef = useRef<HTMLInputElement>(null);

  const active = draft ?? branding;

  const update = (patch: Partial<TenantBrandingConfig>) => {
    setDraft((d) => ({ ...(d ?? branding), ...patch }));
  };

  const handleSave = async () => {
    setMessage('');
    await saveBranding(active);
    setDraft(null);
    setMessage('Branding saved. CRM and Estimates will reflect changes on refresh.');
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage('Please choose an image file (PNG, JPG, SVG, WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
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
      setMessage('Logo uploaded. Click Save branding to apply.');
    } catch (err) {
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
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Company Branding</h1>
      <p className="text-slate-400 text-sm mb-6">
        Customize how your agency appears across CRM, Estimates, and Collections. Changes apply to your whole workspace.
      </p>

      <div className="glass-panel p-6 space-y-6">
        <div>
          <label htmlFor="brand-company" className="text-xs text-slate-400 block mb-1">Company name</label>
          <input
            id="brand-company"
            value={active.companyName}
            onChange={(e) => update({ companyName: e.target.value })}
            placeholder="Studio North Creative"
            className="w-full p-3 rounded bg-brandNavy-800 border border-brandNavy-700"
          />
        </div>

        <div>
          <label htmlFor="brand-tagline" className="text-xs text-slate-400 block mb-1">Tagline</label>
          <input
            id="brand-tagline"
            value={active.tagline ?? ''}
            onChange={(e) => update({ tagline: e.target.value })}
            placeholder="Creative & Digital Services"
            className="w-full p-3 rounded bg-brandNavy-800 border border-brandNavy-700"
          />
        </div>

        <div>
          <label htmlFor="brand-color" className="text-xs text-slate-400 block mb-1">Brand color</label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              aria-label="Brand color picker"
              value={active.primaryColor}
              onChange={(e) => update({ primaryColor: e.target.value })}
              className="h-11 w-11 rounded cursor-pointer border border-brandNavy-700 bg-transparent"
            />
            <input
              id="brand-color"
              value={active.primaryColor}
              onChange={(e) => update({ primaryColor: e.target.value })}
              className="flex-1 p-3 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm"
            />
          </div>
        </div>

        <div>
          <span className="text-xs text-slate-400 block mb-1">Logo</span>
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
              className="px-4 py-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm font-bold hover:border-brandTeal-500/40 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload logo'}
            </button>
            <input
              value={active.logoUrl ?? ''}
              onChange={(e) => update({ logoUrl: e.target.value })}
              placeholder="Or paste logo URL"
              className="flex-1 min-w-[200px] p-3 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
            />
          </div>
          {active.logoUrl && (
            <img
              src={active.logoUrl}
              alt="Logo preview"
              className="mt-3 h-14 w-auto object-contain rounded bg-white/5 p-2"
            />
          )}
        </div>

        <div
          className="brand-preview-panel rounded-xl border p-5"
          style={{ borderColor: active.primaryColor, backgroundColor: `${active.primaryColor}12` }}
        >
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-mono">Preview</p>
          <div className="flex items-center gap-3">
            {active.logoUrl ? (
              <img src={active.logoUrl} alt="" className="h-10 w-auto object-contain" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: active.primaryColor }}
              >
                {display.line1.charAt(0)}
              </div>
            )}
            <div>
              <div className="font-extrabold uppercase tracking-wide text-slate-900 text-sm">
                {display.line1}
                {display.line2 ? (
                  <span style={{ color: active.primaryColor }}> {display.line2}</span>
                ) : null}
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-0.5">
                {active.tagline}
              </div>
            </div>
          </div>
        </div>

        {message && <p className="text-sm text-amber-200/90">{message}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2.5 rounded font-bold text-sm text-white disabled:opacity-50 brand-primary-bg"
          >
            {saving ? 'Saving…' : 'Save branding'}
          </button>
          {draft && (
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-5 py-2.5 rounded font-bold text-sm border border-brandNavy-700 text-slate-400"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
