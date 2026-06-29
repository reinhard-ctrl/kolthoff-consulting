import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';

interface TenantFeatures {
  messenger: boolean;
  approvals: boolean;
  vault: boolean;
  crm: boolean;
}

const defaults: TenantFeatures = { messenger: true, approvals: true, vault: false, crm: false };

export function useTenantFeatures() {
  const [features, setFeatures] = useState<TenantFeatures>(defaults);

  useEffect(() => {
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'tenant_settings', 'config');
    return onSnapshot(ref, (snap) => {
      if (snap.exists() && snap.data().features) setFeatures(snap.data().features);
      else setFeatures(defaults);
    });
  }, []);

  return features;
}
