import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, adminAppId } from '../lib/firebase';
import { getProductConfig } from '../lib/product-config';
import {
  applyTenantBrandingCss,
  mergeTenantBranding,
  type TenantBrandingConfig,
} from '../lib/tenant-branding';

export function useTenantBranding() {
  const product = getProductConfig();
  const [branding, setBranding] = useState<TenantBrandingConfig>(() =>
    mergeTenantBranding(null, product.branding),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ref = doc(db, 'artifacts', adminAppId, 'public', 'data', 'tenant_settings', 'config');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const merged = mergeTenantBranding(
          snap.exists() ? (snap.data().branding as Partial<TenantBrandingConfig>) : null,
          product.branding,
        );
        setBranding(merged);
        applyTenantBrandingCss(merged);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [product.branding]);

  const saveBranding = async (next: TenantBrandingConfig) => {
    setSaving(true);
    try {
      const ref = doc(db, 'artifacts', adminAppId, 'public', 'data', 'tenant_settings', 'config');
      await setDoc(
        ref,
        {
          branding: {
            companyName: next.companyName.trim(),
            tagline: next.tagline?.trim() || '',
            primaryColor: next.primaryColor.trim(),
            logoUrl: next.logoUrl?.trim() || '',
          },
        },
        { merge: true },
      );
    } finally {
      setSaving(false);
    }
  };

  return { branding, loading, saving, saveBranding };
}
