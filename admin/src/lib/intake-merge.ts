import { INTAKE_MAPPED_TARGETS } from './engagement-config';

export type IntakeMappedTarget = (typeof INTAKE_MAPPED_TARGETS)[number];

export function isValidIntakeTarget(target: string): target is IntakeMappedTarget {
  return (INTAKE_MAPPED_TARGETS as readonly string[]).includes(target);
}

export function intakeTargetLabel(target: string): string {
  const labels: Record<string, string> = {
    subSaaS: 'Software Audit (subSaaS)',
    roles: 'Team Roster (roles)',
    customAssets: 'Custom Assets (customAssets)',
  };
  return labels[target] || target;
}

/** Merge intake rows into an existing profile array without blind overwrite. */
export function mergeIntakeResponses(
  existing: Record<string, unknown>[] | undefined,
  incoming: Record<string, unknown>[],
  target: string,
): Record<string, unknown>[] {
  if (!incoming.length) return existing ? [...existing] : [];

  if (target === 'subSaaS') {
    const byKey = new Map<string, Record<string, unknown>>();
    (existing || []).forEach((row) => {
      const key = String(row.tool || '').trim().toLowerCase();
      if (key) byKey.set(key, row);
    });
    incoming.forEach((row) => {
      const key = String(row.tool || '').trim().toLowerCase();
      if (key) byKey.set(key, row);
    });
    return Array.from(byKey.values());
  }

  if (target === 'roles') {
    const byKey = new Map<string, Record<string, unknown>>();
    (existing || []).forEach((row) => {
      const key = String(row.owner || '').trim().toLowerCase();
      if (key) byKey.set(key, row);
    });
    incoming.forEach((row) => {
      const key = String(row.owner || '').trim().toLowerCase();
      if (key) byKey.set(key, row);
    });
    return Array.from(byKey.values());
  }

  return [
    ...(existing || []),
    ...incoming.map((row) => ({ ...row, _intakeAt: new Date().toISOString() })),
  ];
}
