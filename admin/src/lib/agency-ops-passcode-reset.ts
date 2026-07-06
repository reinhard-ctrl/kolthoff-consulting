import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, adminAppId } from './firebase';
import { agencyOpsConsoleUrl } from './agency-ops-active-tenant';
import { AGENCY_OPS_DEMO_TENANT, isAgencyOpsTenantCancelled } from './agency-ops-tenant-status';

function generateAgencyPasscode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 10; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export interface ResetAgencyOpsPasscodeResult {
  tenantId: string;
  clientName: string;
  consoleUrl: string;
  passcode: string;
  message: string;
}

/** Staff-only — rotate client console passcode and update registry. */
export async function resetAgencyOpsPasscode(tenantId: string): Promise<ResetAgencyOpsPasscodeResult> {
  await auth.authStateReady();
  if (!auth.currentUser?.uid) throw new Error('Sign in required before resetting Agency Ops passcodes.');

  const normalized = tenantId.trim();
  if (normalized === AGENCY_OPS_DEMO_TENANT) {
    throw new Error('The sales demo tenant passcode cannot be reset here.');
  }
  if (!/^agency-[a-z0-9-]{2,48}$/.test(normalized)) {
    throw new Error('Invalid Agency Ops tenant ID.');
  }

  const registryRef = doc(db, 'artifacts', adminAppId, 'public', 'data', 'agency_ops_tenants', normalized);
  const registrySnap = await getDoc(registryRef);
  if (!registrySnap.exists()) {
    throw new Error(`Agency Ops tenant "${normalized}" was not found in the registry.`);
  }

  const registry = registrySnap.data() as Record<string, unknown>;
  if (isAgencyOpsTenantCancelled(registry)) {
    throw new Error(`Agency Ops tenant "${normalized}" is cancelled. Re-provision instead of resetting the passcode.`);
  }

  const clientName = String(registry.clientName || normalized);
  const oldPasscode =
    typeof registry.initialPasscode === 'string' ? registry.initialPasscode.trim().toLowerCase() : '';
  const passcode = generateAgencyPasscode();
  const now = Date.now();
  const consoleUrl = agencyOpsConsoleUrl(normalized);

  if (oldPasscode) {
    try {
      await deleteDoc(doc(db, 'artifacts', normalized, 'public', 'data', 'admin_credentials', oldPasscode));
    } catch (err) {
      console.warn(`Could not delete previous passcode for ${normalized}:`, err);
    }
  }

  await setDoc(doc(db, 'artifacts', normalized, 'public', 'data', 'admin_credentials', passcode), {
    role: 'kolthoff_admin',
    note: `Agency Ops tenant ${normalized}`,
    createdAt: now,
    rotatedAt: now,
    rotatedBy: auth.currentUser.uid,
  });

  await setDoc(
    registryRef,
    {
      initialPasscode: passcode,
      initialPasscodeSetAt: now,
      passcodeRotatedAt: now,
      passcodeRotatedBy: auth.currentUser.uid,
      consoleUrl,
      updatedAt: now,
    },
    { merge: true },
  );

  return {
    tenantId: normalized,
    clientName,
    consoleUrl,
    passcode,
    message: `New passcode set for ${clientName}. Share the updated handoff with the client.`,
  };
}
