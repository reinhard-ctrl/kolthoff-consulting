import { getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { adminCol, adminDoc } from './firebase';
import { mergePortalContractsFromInvoices, type InvoiceRecord } from './invoices';

/** Push invoice rows into clients/{accessCode}.contracts for portal billing tab. */
export async function syncPortalBillingForAccessCode(
  accessCode: string,
  allInvoices?: InvoiceRecord[],
) {
  if (!accessCode) return;

  let invoices = allInvoices;
  if (!invoices) {
    const snap = await getDocs(query(adminCol('invoices'), where('portalAccessCode', '==', accessCode)));
    invoices = [];
    snap.forEach((d) => invoices!.push({ id: d.id, ...d.data() } as InvoiceRecord));
  } else {
    invoices = invoices.filter((i) => i.portalAccessCode === accessCode);
  }

  const portalRef = adminDoc('clients', accessCode);
  const portalSnap = await getDoc(portalRef);
  if (!portalSnap.exists()) return;

  const existing = portalSnap.data();
  const contracts = mergePortalContractsFromInvoices(existing?.contracts, invoices);
  await setDoc(portalRef, { contracts }, { merge: true });
}

/** Sync all portal access codes that have invoices for a profile. */
export async function syncPortalBillingForProfile(profileId: string, portalAccessCode: string | null) {
  if (portalAccessCode) {
    await syncPortalBillingForAccessCode(portalAccessCode);
    return;
  }

  const snap = await getDocs(query(adminCol('invoices'), where('profileId', '==', profileId)));
  const codes = new Set<string>();
  snap.forEach((d) => {
    const code = d.data().portalAccessCode;
    if (code) codes.add(code);
  });
  await Promise.all([...codes].map((code) => syncPortalBillingForAccessCode(code)));
}
