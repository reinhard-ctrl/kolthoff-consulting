import {
  DEFAULT_QUICK_ACTION_IDS,
  getQuickAction,
  QUICK_ACTION_CATALOG,
  type QuickActionDef,
} from '../config/quickActions';

const STORAGE_KEY = 'kolthoff-admin-quick-actions';

export type QuickActionPreferences = {
  order: string[];
};

function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function loadQuickActionPreferences(): QuickActionPreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickActionPreferences;
    if (!Array.isArray(parsed.order)) return null;
    return sanitizeQuickActionPreferences(parsed);
  } catch {
    return null;
  }
}

export function saveQuickActionPreferences(prefs: QuickActionPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeQuickActionPreferences(prefs)));
}

export function clearQuickActionPreferences() {
  localStorage.removeItem(STORAGE_KEY);
}

export function sanitizeQuickActionPreferences(prefs: QuickActionPreferences): QuickActionPreferences {
  const catalogIds = new Set(QUICK_ACTION_CATALOG.map((action) => action.id));
  const order = dedupeIds(prefs.order).filter((id) => catalogIds.has(id));
  if (order.length === 0) return { order: [...DEFAULT_QUICK_ACTION_IDS] };
  return { order };
}

export function getEffectiveQuickActions(): QuickActionDef[] {
  const prefs = loadQuickActionPreferences();
  const order = prefs?.order ?? DEFAULT_QUICK_ACTION_IDS;
  return order.map((id) => getQuickAction(id)).filter((action): action is QuickActionDef => Boolean(action));
}

export function reorderQuickActions(order: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= order.length || toIndex >= order.length) {
    return order;
  }
  const copy = [...order];
  const [removed] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, removed);
  return copy;
}

export function replaceQuickAction(order: string[], index: number, nextId: string): string[] {
  if (index < 0 || index >= order.length || !getQuickAction(nextId)) return order;
  const existingIndex = order.indexOf(nextId);
  if (existingIndex >= 0 && existingIndex !== index) {
    const copy = [...order];
    [copy[index], copy[existingIndex]] = [copy[existingIndex], copy[index]];
    return dedupeIds(copy);
  }
  const copy = [...order];
  copy[index] = nextId;
  return dedupeIds(copy);
}

export function removeQuickAction(order: string[], index: number): string[] {
  if (order.length <= 1) return order;
  return order.filter((_, i) => i !== index);
}

export function addQuickAction(order: string[], id: string): string[] {
  if (!getQuickAction(id) || order.includes(id)) return order;
  return [...order, id];
}
