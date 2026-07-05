import { useEffect, useRef, useState } from 'react';
import { deleteField, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db, adminAppId } from '../lib/firebase';
import { getProductConfig, isAgencyOpsStarter } from '../lib/product-config';
import {
  loadClientDemoBrandingPresets,
  mergeClientDemoBrandingPresets,
  removeClientDemoBrandingPreset,
  upsertClientDemoBrandingPreset,
} from '../lib/client-demo-branding';
import {
  applyTenantBrandingCss,
  brandingPresetsToMap,
  filterBundledDemoBrandingPresets,
  isBundledDemoBrandingPresetId,
  listBrandingPresets,
  mergeDemoBrandingPresets,
  mergeTenantBranding,
  presetFromConfig,
  presetToConfig,
  shouldRestoreDemoBrandingPresets,
  uniquePresetId,
  type BrandingPreset,
  type TenantBrandingConfig,
} from '../lib/tenant-branding';

function brandingPayload(config: TenantBrandingConfig) {
  return {
    companyName: config.companyName.trim(),
    tagline: config.tagline?.trim() || '',
    primaryColor: config.primaryColor.trim(),
    logoUrl: config.logoUrl?.trim() || '',
  };
}

function tenantConfigRef() {
  return doc(db, 'artifacts', adminAppId, 'public', 'data', 'tenant_settings', 'config');
}

/** updateDoc replaces top-level map fields; setDoc merge leaves removed nested keys behind. */
async function writeTenantConfig(patch: Record<string, unknown>) {
  const ref = tenantConfigRef();
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, patch);
  } else {
    await setDoc(ref, patch);
  }
}

export function useTenantBranding() {
  const product = getProductConfig();
  const agencyOps = isAgencyOpsStarter(product.id);
  const [branding, setBranding] = useState<TenantBrandingConfig>(() =>
    mergeTenantBranding(null, product.branding, product.id),
  );
  const [demoPresets, setDemoPresets] = useState<BrandingPreset[]>([]);
  const [clientDemoPresets, setClientDemoPresets] = useState<BrandingPreset[]>(() =>
    agencyOps ? loadClientDemoBrandingPresets() : [],
  );
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(agencyOps);
  const [saving, setSaving] = useState(false);
  const [presetsFieldPresent, setPresetsFieldPresent] = useState(false);
  const demoPresetsRestoreAttempted = useRef(false);
  const customPresetMigrationAttempted = useRef(false);

  const presets = [...demoPresets, ...clientDemoPresets];

  useEffect(() => {
    if (!agencyOps) {
      setBranding(mergeTenantBranding(null, product.branding, product.id));
      setDemoPresets([]);
      setClientDemoPresets([]);
      setActivePresetId(null);
      setLoading(false);
      return;
    }

    setClientDemoPresets(loadClientDemoBrandingPresets());

    const ref = doc(db, 'artifacts', adminAppId, 'public', 'data', 'tenant_settings', 'config');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const merged = mergeTenantBranding(
          data?.branding as Partial<TenantBrandingConfig> | undefined,
          product.branding,
          product.id,
        );
        const firestorePresets = listBrandingPresets(
          data?.brandingPresets as Record<string, unknown> | undefined,
        );
        const bundled = filterBundledDemoBrandingPresets(firestorePresets);
        const leakedCustom = firestorePresets.filter(
          (preset) => !isBundledDemoBrandingPresetId(preset.id),
        );

        setBranding(merged);
        setDemoPresets(bundled);
        setPresetsFieldPresent(
          Boolean(data && typeof data.brandingPresets === 'object' && data.brandingPresets !== null),
        );
        setActivePresetId(
          typeof data?.activeBrandingPresetId === 'string' ? data.activeBrandingPresetId : null,
        );
        applyTenantBrandingCss(merged);
        setLoading(false);

        if (leakedCustom.length > 0 && !customPresetMigrationAttempted.current) {
          customPresetMigrationAttempted.current = true;
          const migrated = mergeClientDemoBrandingPresets(leakedCustom);
          setClientDemoPresets(migrated);
          void (async () => {
            try {
              const patch: Record<string, unknown> = {};
              for (const preset of leakedCustom) {
                patch[`brandingPresets.${preset.id}`] = deleteField();
              }
              const configRef = tenantConfigRef();
              const configSnap = await getDoc(configRef);
              if (configSnap.exists()) {
                await updateDoc(configRef, patch);
              }
            } catch {
              customPresetMigrationAttempted.current = false;
            }
          })();
        }
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [agencyOps, product.branding, product.id]);

  useEffect(() => {
    if (loading || !isAgencyOpsStarter(product.id)) return;
    if (demoPresetsRestoreAttempted.current) return;
    if (!shouldRestoreDemoBrandingPresets(demoPresets, presetsFieldPresent)) return;
    demoPresetsRestoreAttempted.current = true;

    void (async () => {
      setSaving(true);
      try {
        await writeTenantConfig({
          brandingPresets: brandingPresetsToMap(mergeDemoBrandingPresets(demoPresets)),
        });
      } catch {
        demoPresetsRestoreAttempted.current = false;
      } finally {
        setSaving(false);
      }
    })();
  }, [loading, demoPresets, presetsFieldPresent, product.id]);

  const saveBranding = async (next: TenantBrandingConfig, presetId?: string | null) => {
    const resolvedPresetId = presetId ?? activePresetId;
    if (resolvedPresetId && !isBundledDemoBrandingPresetId(resolvedPresetId)) {
      return false;
    }

    setSaving(true);
    try {
      await writeTenantConfig({
        branding: brandingPayload(next),
        activeBrandingPresetId: isBundledDemoBrandingPresetId(resolvedPresetId)
          ? resolvedPresetId
          : deleteField(),
      });
      return true;
    } finally {
      setSaving(false);
    }
  };

  /** Save current form as a named preset (does not apply until you click Apply). */
  const savePreset = async (name: string, config: TenantBrandingConfig, existingId?: string) => {
    setSaving(true);
    try {
      const allIds = presets.map((preset) => preset.id);
      const id = existingId || uniquePresetId(name, allIds);
      const preset = presetFromConfig(id, name, config);

      if (isBundledDemoBrandingPresetId(id)) {
        const nextDemoPresets = [
          ...demoPresets.filter((item) => item.id !== id),
          preset,
        ];
        await writeTenantConfig({
          brandingPresets: brandingPresetsToMap(mergeDemoBrandingPresets(nextDemoPresets)),
        });
      } else {
        const nextClientDemos = upsertClientDemoBrandingPreset(preset);
        setClientDemoPresets(nextClientDemos);
      }
      return id;
    } finally {
      setSaving(false);
    }
  };

  /** Apply a saved preset. Demo profiles update shared workspace; client demos preview locally only. */
  const applyPreset = async (presetId: string): Promise<'workspace' | 'client-demo'> => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return 'client-demo';

    if (!isBundledDemoBrandingPresetId(presetId)) {
      applyTenantBrandingCss(presetToConfig(preset));
      return 'client-demo';
    }

    setSaving(true);
    try {
      await writeTenantConfig({
        branding: brandingPayload(presetToConfig(preset)),
        activeBrandingPresetId: presetId,
      });
      return 'workspace';
    } finally {
      setSaving(false);
    }
  };

  const deletePreset = async (presetId: string) => {
    setSaving(true);
    try {
      if (isBundledDemoBrandingPresetId(presetId)) {
        const ref = tenantConfigRef();
        const patch: Record<string, unknown> = {
          [`brandingPresets.${presetId}`]: deleteField(),
        };
        if (activePresetId === presetId) {
          patch.activeBrandingPresetId = deleteField();
        }
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, patch);
        } else {
          await setDoc(ref, { brandingPresets: {} });
        }
        return;
      }

      const nextClientDemos = removeClientDemoBrandingPreset(presetId);
      setClientDemoPresets(nextClientDemos);
    } finally {
      setSaving(false);
    }
  };

  const restoreDemoPresets = async () => {
    setSaving(true);
    try {
      await writeTenantConfig({
        brandingPresets: brandingPresetsToMap(mergeDemoBrandingPresets(demoPresets)),
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    branding,
    presets,
    demoPresets,
    clientDemoPresets,
    activePresetId,
    loading,
    saving,
    saveBranding,
    savePreset,
    applyPreset,
    deletePreset,
    restoreDemoPresets,
  };
}
