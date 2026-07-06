export interface OrgChartMember {
  id: string;
  name: string;
  role: string;
  department: string;
  managerId: string | null;
}

export interface OrgChartData {
  members: OrgChartMember[];
  drawioXml?: string;
  updatedAt?: string;
}

export interface OrgChartTreeNode extends OrgChartMember {
  children: OrgChartTreeNode[];
}

export interface LegacyRoleRow {
  owner?: string;
  name?: string;
  role?: string;
  title?: string;
}

export function createOrgMemberId(): string {
  return `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyOrgMember(): OrgChartMember {
  return {
    id: createOrgMemberId(),
    name: '',
    role: '',
    department: '',
    managerId: null,
  };
}

/** Migrate legacy intake roster rows into org chart members. */
export function migrateRolesToOrgChart(roles?: LegacyRoleRow[]): OrgChartMember[] {
  return (roles || []).map((row) => ({
    id: createOrgMemberId(),
    name: String(row.owner || row.name || '').trim(),
    role: String(row.role || row.title || '').trim(),
    department: '',
    managerId: null,
  }));
}

export function normalizeOrgChart(raw: unknown): OrgChartData {
  if (!raw || typeof raw !== 'object') return { members: [] };
  const data = raw as { members?: unknown; drawioXml?: string; updatedAt?: string };
  const members = Array.isArray(data.members)
    ? data.members
        .filter((m): m is OrgChartMember => Boolean(m && typeof m === 'object'))
        .map((m) => ({
          id: String((m as OrgChartMember).id || createOrgMemberId()),
          name: String((m as OrgChartMember).name || '').trim(),
          role: String((m as OrgChartMember).role || '').trim(),
          department: String((m as OrgChartMember).department || '').trim(),
          managerId: (m as OrgChartMember).managerId ? String((m as OrgChartMember).managerId) : null,
        }))
    : [];
  return {
    members,
    drawioXml: typeof data.drawioXml === 'string' ? data.drawioXml : undefined,
    updatedAt: data.updatedAt,
  };
}

export function resolveOrgChartFromProfile(profile: {
  orgChart?: unknown;
  roles?: LegacyRoleRow[];
}): OrgChartData {
  const normalized = normalizeOrgChart(profile.orgChart);
  if (normalized.members.length) return normalized;
  const migrated = migrateRolesToOrgChart(profile.roles);
  return migrated.length ? { members: migrated } : { members: [] };
}

export function isDescendantMember(
  members: OrgChartMember[],
  memberId: string,
  potentialManagerId: string,
): boolean {
  let current: string | null = potentialManagerId;
  const byId = new Map(members.map((m) => [m.id, m]));
  while (current) {
    if (current === memberId) return true;
    current = byId.get(current)?.managerId ?? null;
  }
  return false;
}

export function buildOrgChartTree(members: OrgChartMember[]): OrgChartTreeNode[] {
  const nodes = new Map<string, OrgChartTreeNode>();
  members.forEach((m) => nodes.set(m.id, { ...m, children: [] }));
  const roots: OrgChartTreeNode[] = [];
  members.forEach((m) => {
    const node = nodes.get(m.id);
    if (!node) return;
    if (m.managerId && nodes.has(m.managerId) && m.managerId !== m.id) {
      nodes.get(m.managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (list: OrgChartTreeNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    list.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

export function managerName(members: OrgChartMember[], managerId: string | null): string {
  if (!managerId) return '—';
  return members.find((m) => m.id === managerId)?.name || '—';
}
