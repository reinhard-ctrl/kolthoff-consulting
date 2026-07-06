import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, getWorkspaceTenantId } from '../lib/firebase';

interface TenantFeatures {
  messenger: boolean;
  approvals: boolean;
  vault: boolean;
  crm: boolean;
}

const defaults: TenantFeatures = { messenger: true, approvals: true, vault: true, crm: false };

export function useTenantFeatures() {
  const [features, setFeatures] = useState<TenantFeatures>(defaults);

  useEffect(() => {
    const tenantId = getWorkspaceTenantId();
    if (!tenantId) {
      setFeatures(defaults);
      return;
    }

    const ref = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
    return onSnapshot(ref, (snap) => {
      if (snap.exists() && snap.data().features) setFeatures(snap.data().features);
      else setFeatures(defaults);
    });
  }, []);

  return features;
}
