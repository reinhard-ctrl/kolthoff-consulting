import { doc, getDoc } from 'firebase/firestore';
import { auth, db, bootstrapAnonymousForPasscode, getAdminAppId } from './firebase';
import { getProductConfig, isAgencyOpsStarter } from './product-config';
import { isAgencyOpsTenantCancelled } from './agency-ops-tenant-status';

/** Returns an error message when the current Agency Ops tenant is cancelled, otherwise null. */
export async function getAgencyOpsTenantAccessBlockReason(): Promise<string | null> {
  if (!isAgencyOpsStarter()) return null;

  const product = getProductConfig();
  if (product.isDemo) return null;

  await auth.authStateReady();
  if (!auth.currentUser) {
    try {
      await bootstrapAnonymousForPasscode();
    } catch {
      return null;
    }
  }

  const registryRef = doc(db, 'artifacts', 'kolthoff-admin-app', 'public', 'data', 'agency_ops_tenants', getAdminAppId());
  try {
    const registrySnap = await getDoc(registryRef);
    if (registrySnap.exists() && isAgencyOpsTenantCancelled(registrySnap.data() as Record<string, unknown>)) {
      return 'This Agency Ops account has been cancelled. Contact Kolthoff Consulting if you need access restored.';
    }
  } catch (err) {
    console.warn('Could not read Agency Ops tenant registry status:', err);
  }

  try {
    const configRef = doc(db, 'artifacts', getAdminAppId(), 'public', 'data', 'tenant_settings', 'config');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists() && isAgencyOpsTenantCancelled(configSnap.data() as Record<string, unknown>)) {
      return 'This Agency Ops account has been cancelled. Contact Kolthoff Consulting if you need access restored.';
    }
  } catch {
    /* config read requires tenant membership — registry check is enough for most cases */
  }

  return null;
}
