import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, getWorkspaceTenantId } from '../lib/firebase';
import {
  applyDocumentTitle,
  applyWorkspaceBrandingCss,
  DEFAULT_WORKSPACE_BRANDING,
  mergeWorkspaceBranding,
  type WorkspaceBranding,
} from '../lib/tenant-branding';

export function useWorkspaceBranding() {
  const [branding, setBranding] = useState<WorkspaceBranding>(DEFAULT_WORKSPACE_BRANDING);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = getWorkspaceTenantId();
    if (!tenantId) {
      setBranding(DEFAULT_WORKSPACE_BRANDING);
      applyWorkspaceBrandingCss(DEFAULT_WORKSPACE_BRANDING);
      applyDocumentTitle(DEFAULT_WORKSPACE_BRANDING);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const name = typeof data?.clientName === 'string' ? data.clientName : '';
        setClientName(name);
        const merged = mergeWorkspaceBranding(
          data?.branding as Partial<WorkspaceBranding> | undefined,
          name,
        );
        setBranding(merged);
        applyWorkspaceBrandingCss(merged);
        applyDocumentTitle(merged);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  return { branding, clientName, loading };
}
