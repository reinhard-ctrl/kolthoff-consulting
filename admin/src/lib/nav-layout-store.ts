import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, adminAppId } from './firebase';
import {
  applyNavPreferences,
  buildPreferencesFromGroups,
  migrateNavPreferences,
  NAV_PREFS_VERSION,
  type NavPreferences,
} from './navPreferences';
import { type NavGroup } from '../config/navigation';
import { getProductConfig } from './product-config';

const NAV_LAYOUT_PATH = ['artifacts', adminAppId, 'public', 'data', 'admin_settings', 'nav_layout'] as const;

function navLayoutRef() {
  return doc(db, NAV_LAYOUT_PATH[0], NAV_LAYOUT_PATH[1], NAV_LAYOUT_PATH[2], NAV_LAYOUT_PATH[3], NAV_LAYOUT_PATH[4], NAV_LAYOUT_PATH[5]);
}

export async function loadOrgNavLayout(): Promise<NavPreferences | null> {
  try {
    const snap = await getDoc(navLayoutRef());
    if (!snap.exists()) return null;
    const data = snap.data() as NavPreferences;
    if (!data?.assignments) return null;
    if (data.version !== NAV_PREFS_VERSION) return null;
    return migrateNavPreferences(data);
  } catch (err) {
    console.warn('Could not load org nav layout:', err);
    return null;
  }
}

export async function saveOrgNavLayout(groups: NavGroup[]): Promise<void> {
  const prefs = buildPreferencesFromGroups(groups);
  await setDoc(
    navLayoutRef(),
    {
      ...prefs,
      version: NAV_PREFS_VERSION,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export function navGroupsFromPreferences(prefs: NavPreferences): NavGroup[] {
  const catalog = getProductConfig().navGroups;
  return applyNavPreferences(catalog, prefs);
}
