import { getDoc, setDoc } from 'firebase/firestore';
import {
  buildDefaultPortalRoadmap,
  buildProfileLinks,
  getChaosTaxValue,
  getClientDisplayName,
  MODULES,
} from './engagement-config';
import { adminDoc } from './firebase';

export interface PortalMetrics {
  annualLeakageIdentified: number;
  chaosTaxEliminated: number;
  saasSavingsIdentified: number;
}

export interface PortalAsset {
  id?: number;
  title?: string;
  category?: string;
  date?: string;
  type?: string;
  gDriveLink?: string;
  [key: string]: string | number | undefined;
}

export interface PortalClientRecord {
  companyName: string;
  repName: string;
  sowReference: string;
  currentPhase: string;
  progressPercentage: number;
  metrics: PortalMetrics;
  actionItems: PortalAsset[];
  roadmap: PortalAsset[];
  assets: PortalAsset[];
  contracts: PortalAsset[];
  orgChart?: Array<{
    id?: string;
    name?: string;
    role?: string;
    department?: string;
    managerId?: string | null;
  }>;
  subSaaS?: Array<{ tool?: string; billing?: number; users?: number; reason?: string }>;
}

export interface WorkbookProfileForPortal {
  id?: string;
  clientCompany?: string;
  clientName?: string;
  clientRep?: string;
  quoteId?: string;
  links?: { portalClientId?: string; crmDealId?: string };
  subSaaS?: Array<{ tool?: string; billing?: number; users?: number; reason?: string }>;
  orgChart?: { members?: Array<{ id?: string; name?: string; role?: string; department?: string; managerId?: string | null }> };
  roles?: Array<{ owner?: string; name?: string; role?: string; title?: string }>;
  customAssets?: Array<{ title?: string; category?: string; link?: string }>;
  chaosTax?: { value?: number };
  annualOperationalLeakage?: number;
}

export function resolvePortalAccessCode(profile: WorkbookProfileForPortal): string | null {
  return profile.quoteId || profile.links?.portalClientId || null;
}

export function computeSaasAnnualWaste(
  subSaaS?: Array<{ billing?: number; users?: number }>,
): number {
  if (!subSaaS?.length) return 0;
  const monthly = subSaaS.reduce(
    (acc, row) => acc + (Number(row.billing) || 0) * (Number(row.users) || 1),
    0,
  );
  return Math.round(monthly * 12);
}

export function mapSubSaaSToPortalAssets(
  subSaaS?: WorkbookProfileForPortal['subSaaS'],
): PortalAsset[] {
  return (subSaaS || []).map((row, i) => ({
    id: Date.now() + i,
    title: String(row.tool || 'Software tool'),
    category: 'MOD 1',
    date: new Date().toISOString().slice(0, 10),
    type: 'link',
    gDriveLink: String(row.reason || 'Synced from SOW / diagnosis'),
  }));
}

export function mapCustomAssetsToPortalAssets(
  customAssets?: WorkbookProfileForPortal['customAssets'],
): PortalAsset[] {
  return (customAssets || []).map((row, i) => ({
    id: Date.now() + i + 1000,
    title: String(row.title || 'Custom asset'),
    category: String(row.category || 'MOD 1'),
    date: new Date().toISOString().slice(0, 10),
    type: 'link',
    gDriveLink: String(row.link || ''),
  }));
}

export function mapOrgChartToPortal(
  orgChart?: WorkbookProfileForPortal['orgChart'],
): PortalClientRecord['orgChart'] {
  const members = orgChart?.members || [];
  return members
    .filter((m) => String(m.name || '').trim())
    .map((m) => ({
      id: String(m.id || ''),
      name: String(m.name || '').trim(),
      role: String(m.role || '').trim(),
      department: String(m.department || '').trim(),
      managerId: m.managerId ? String(m.managerId) : null,
    }));
}

export function mapRolesToActionItems(
  roles?: WorkbookProfileForPortal['roles'],
): PortalAsset[] {
  return (roles || []).map((row, i) => ({
    id: Date.now() + i + 2000,
    title: String(row.owner || row.name || 'Team member'),
    desc: String(row.role || row.title || 'Role pending'),
    type: 'roster',
    status: 'pending',
  }));
}

export function mergeActionItems(existing: PortalAsset[], incoming: PortalAsset[]): PortalAsset[] {
  const byTitle = new Map<string, PortalAsset>();
  existing.forEach((a) => {
    const key = String(a.title || '').trim().toLowerCase();
    if (key) byTitle.set(key, a);
  });
  incoming.forEach((a) => {
    const key = String(a.title || '').trim().toLowerCase();
    if (key) byTitle.set(key, a);
  });
  return Array.from(byTitle.values());
}

export function mergePortalAssets(existing: PortalAsset[], incoming: PortalAsset[]): PortalAsset[] {
  const byTitle = new Map<string, PortalAsset>();
  existing.forEach((a) => {
    const key = String(a.title || '').trim().toLowerCase();
    if (key) byTitle.set(key, a);
  });
  incoming.forEach((a) => {
    const key = String(a.title || '').trim().toLowerCase();
    if (key) byTitle.set(key, a);
  });
  return Array.from(byTitle.values());
}

export function buildPortalPatchFromProfile(
  profile: WorkbookProfileForPortal,
  existing?: PortalClientRecord | null,
  options?: { syncIntakeAssets?: boolean; syncOrgChart?: boolean },
): Partial<PortalClientRecord> {
  const saasWaste = computeSaasAnnualWaste(profile.subSaaS);
  const patch: Partial<PortalClientRecord> = {
    companyName: getClientDisplayName(profile),
    repName: profile.clientRep || existing?.repName || 'Representative',
    sowReference: profile.quoteId || existing?.sowReference || '',
    metrics: {
      annualLeakageIdentified: getChaosTaxValue(profile),
      chaosTaxEliminated: existing?.metrics?.chaosTaxEliminated ?? 0,
      saasSavingsIdentified: saasWaste || existing?.metrics?.saasSavingsIdentified || 0,
    },
  };

  if (!existing?.roadmap?.length) {
    patch.roadmap = buildDefaultPortalRoadmap();
  }

  if (!existing?.currentPhase) {
    patch.currentPhase = MODULES[0].portalPhase;
  }

  if (options?.syncIntakeAssets) {
    const fromSaas = mapSubSaaSToPortalAssets(profile.subSaaS);
    const fromCustom = mapCustomAssetsToPortalAssets(profile.customAssets);
    patch.assets = mergePortalAssets(existing?.assets || [], [...fromSaas, ...fromCustom]);
  }

  if (options?.syncOrgChart) {
    patch.orgChart = mapOrgChartToPortal(profile.orgChart);
  }

  return patch;
}

export async function syncProfileToPortalIfExists(
  profile: WorkbookProfileForPortal,
  options?: { syncIntakeAssets?: boolean; syncOrgChart?: boolean },
): Promise<string | null> {
  const code = resolvePortalAccessCode(profile);
  if (!code) return null;

  const portalRef = adminDoc('clients', code);
  const snap = await getDoc(portalRef);
  if (!snap.exists()) return null;

  const patch = buildPortalPatchFromProfile(profile, snap.data() as PortalClientRecord, options);
  await setDoc(portalRef, patch, { merge: true });
  return code;
}

export async function writePortalLinkToProfile(
  profileId: string,
  portalClientId: string,
  profile?: WorkbookProfileForPortal,
): Promise<void> {
  const links = buildProfileLinks({
    id: profileId,
    quoteId: profile?.quoteId,
    links: { ...(profile?.links || {}), portalClientId },
  });
  await setDoc(adminDoc('workbook_profiles', profileId), { links }, { merge: true });
}
