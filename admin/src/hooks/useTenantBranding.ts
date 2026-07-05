import { useEffect, useRef, useState } from 'react';
import { deleteField, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db, adminAppId } from '../lib/firebase';
import { getProductConfig, isAgencyOpsStarter } from '../lib/product-config';
import {
  clearLegacyClientDemoBrandingPresets,
  loadAppliedClientDemoId,
  loadLegacyClientDemoBrandingPresets,
  listClientDemoPresets,
  mergeClientDemoBrandingPresets,
  mergeDefaultClientDemoPresets,
  restoreDefaultClientDemoPresets,
  saveAppliedClientDemoId,
  seedDefaultClientDemoPresets,
  shouldSeedDefaultClientDemoPresets,
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

function isDeleteFieldValue(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { _methodName?: string })._methodName === 'deleteField',
  );
}

function omitDeleteFields(patch: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => !isDeleteFieldValue(value)),
  );
}

/** updateDoc replaces top-level map fields; setDoc cannot use deleteField(). */
async function writeTenantConfig(patch: Record<string, unknown>) {
  const ref = tenantConfigRef();
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, patch);
  } else {
    const createPatch = omitDeleteFields(patch);
    if (Object.keys(createPatch).length > 0) {
      await setDoc(ref, createPatch);
    }
  }
}

async function writeClientDemoPresets(presets: BrandingPreset[]) {
  await writeTenantConfig({
    clientDemoPresets: brandingPresetsToMap(presets),
  });
}

export function useTenantBranding() {
  const product = getProductConfig();
  const agencyOps = isAgencyOpsStarter(product.id);
  const [branding, setBranding] = useState<TenantBrandingConfig>(() =>
    mergeTenantBranding(null, product.branding, product.id),
  );
  const [demoPresets, setDemoPresets] = useState<BrandingPreset[]>([]);
  const [clientDemoPresets, setClientDemoPresets] = useState<BrandingPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [appliedClientDemoId, setAppliedClientDemoId] = useState<string | null>(() =>
    agencyOps ? loadAppliedClientDemoId() : null,
  );
  const [loading, setLoading] = useState(agencyOps);
  const [saving, setSaving] = useState(false);
  const [presetsFieldPresent, setPresetsFieldPresent] = useState(false);
  const demoPresetsRestoreAttempted = useRef(false);
  const customPresetMigrationAttempted = useRef(false);
  const clientDemoMigrationAttempted = useRef(false);
  const clientDemoSeedAttempted = useRef(false);

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

    const ref = tenantConfigRef();
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
        const hasClientDemoField = Boolean(
          data && typeof data.clientDemoPresets === 'object' && data.clientDemoPresets !== null,
        );
        const firestoreClientDemos = listClientDemoPresets(
          data?.clientDemoPresets as Record<string, unknown> | undefined,
        );

        setBranding(merged);
        setDemoPresets(bundled);
        setClientDemoPresets(firestoreClientDemos);
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
          const migrated = mergeClientDemoBrandingPresets(firestoreClientDemos, leakedCustom);
          setClientDemoPresets(migrated);
          void (async () => {
            try {
              const patch: Record<string, unknown> = {
                clientDemoPresets: brandingPresetsToMap(migrated),
              };
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

        if (
          firestoreClientDemos.length === 0 &&
          !hasClientDemoField &&
          !clientDemoMigrationAttempted.current
        ) {
          const legacy = loadLegacyClientDemoBrandingPresets();
          if (legacy.length > 0) {
            clientDemoMigrationAttempted.current = true;
            const migrated = mergeClientDemoBrandingPresets([], legacy);
            setClientDemoPresets(migrated);
            void (async () => {
              try {
                await writeClientDemoPresets(migrated);
                clearLegacyClientDemoBrandingPresets();
              } catch {
                clientDemoMigrationAttempted.current = false;
              }
            })();
          }
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

  useEffect(() => {
    if (loading || !isAgencyOpsStarter(product.id)) return;
    if (clientDemoSeedAttempted.current) return;
    if (!shouldSeedDefaultClientDemoPresets(clientDemoPresets)) return;
    clientDemoSeedAttempted.current = true;

    void (async () => {
      setSaving(true);
      try {
        const next = seedDefaultClientDemoPresets(clientDemoPresets);
        await writeClientDemoPresets(next);
      } catch {
        clientDemoSeedAttempted.current = false;
      } finally {
        setSaving(false);
      }
    })();
  }, [loading, clientDemoPresets, product.id]);

  const setAppliedClientDemo = (presetId: string | null) => {
    setAppliedClientDemoId(presetId);
    saveAppliedClientDemoId(presetId);
  };

  const saveBranding = async (next: TenantBrandingConfig, presetId?: string | null) => {
    const resolvedPresetId = presetId ?? activePresetId;
    const isDemoPreset = isBundledDemoBrandingPresetId(resolvedPresetId);
    const isClientDemoPreset = Boolean(
      resolvedPresetId && !isBundledDemoBrandingPresetId(resolvedPresetId),
    );

    setSaving(true);
    try {
      await writeTenantConfig({
        branding: brandingPayload(next),
        activeBrandingPresetId: isDemoPreset ? resolvedPresetId : deleteField(),
      });
      if (isClientDemoPreset) {
        setAppliedClientDemo(resolvedPresetId);
      } else if (isDemoPreset) {
        setAppliedClientDemo(null);
      }
      applyTenantBrandingCss(next);
      return true;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Could not save workspace branding.');
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
        const nextClientDemos = upsertClientDemoBrandingPreset(clientDemoPresets, preset);
        await writeClientDemoPresets(nextClientDemos);
      }
      return id;
    } finally {
      setSaving(false);
    }
  };

  /** Apply a saved preset to the workspace. Client demo profiles stay out of brandingPresets. */
  const applyPreset = async (presetId: string): Promise<'workspace' | 'client-demo'> => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return 'client-demo';

    setSaving(true);
    try {
      await writeTenantConfig({
        branding: brandingPayload(presetToConfig(preset)),
        activeBrandingPresetId: isBundledDemoBrandingPresetId(presetId) ? presetId : deleteField(),
      });
      if (isBundledDemoBrandingPresetId(presetId)) {
        setAppliedClientDemo(null);
        applyTenantBrandingCss(presetToConfig(preset));
        return 'workspace';
      }
      setAppliedClientDemo(presetId);
      applyTenantBrandingCss(presetToConfig(preset));
      return 'client-demo';
    } catch (err) {
      throw err instanceof Error ? err : new Error('Could not apply branding profile.');
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

      const ref = tenantConfigRef();
      const patch: Record<string, unknown> = {
        [`clientDemoPresets.${presetId}`]: deleteField(),
      };
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, patch);
      }
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

  const restoreClientDemos = async () => {
    setSaving(true);
    try {
      const next = restoreDefaultClientDemoPresets(clientDemoPresets);
      await writeClientDemoPresets(next);
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
    appliedClientDemoId,
    loading,
    saving,
    saveBranding,
    savePreset,
    applyPreset,
    deletePreset,
    restoreDemoPresets,
    restoreClientDemos,
  };
}
