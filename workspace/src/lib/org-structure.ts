export interface OrgDepartment {
  id: string;
  name: string;
  parentId?: string | null;
  headUserId?: string | null;
  updatedAt?: number;
}

export interface OrgPerson {
  id: string;
  email?: string;
  name?: string;
  /** Auth/workspace ACL role */
  role?: string;
  /** Job title shown on org chart */
  jobTitle?: string;
  /** Org role used for approval routing (e.g. Finance, HR Manager) */
  orgRole?: string;
  departmentId?: string | null;
  managerId?: string | null;
  firebaseUid?: string;
}

export interface OrgTreeNode extends OrgPerson {
  children: OrgTreeNode[];
}

export function createDeptId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
  return `dept_${slug || Date.now().toString(36)}`;
}

export function buildOrgTree(people: OrgPerson[]): OrgTreeNode[] {
  const nodes = new Map<string, OrgTreeNode>();
  people.forEach((p) => nodes.set(p.id, { ...p, children: [] }));
  const roots: OrgTreeNode[] = [];
  people.forEach((p) => {
    const node = nodes.get(p.id);
    if (!node) return;
    if (p.managerId && nodes.has(p.managerId) && p.managerId !== p.id) {
      nodes.get(p.managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (list: OrgTreeNode[]) => {
    list.sort((a, b) => (a.name || a.email || a.id).localeCompare(b.name || b.email || b.id));
    list.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

export function isDescendant(people: OrgPerson[], personId: string, potentialManagerId: string): boolean {
  const byId = new Map(people.map((p) => [p.id, p]));
  let current: string | null = potentialManagerId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    if (current === personId) return true;
    seen.add(current);
    current = byId.get(current)?.managerId ?? null;
  }
  return false;
}

export function collectOrgRoles(people: OrgPerson[]): string[] {
  const set = new Set<string>();
  people.forEach((p) => {
    const role = (p.orgRole || p.jobTitle || '').trim();
    if (role) set.add(role);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function departmentPath(
  departments: OrgDepartment[],
  departmentId: string | null | undefined,
): OrgDepartment[] {
  if (!departmentId) return [];
  const byId = new Map(departments.map((d) => [d.id, d]));
  const path: OrgDepartment[] = [];
  let current: string | null | undefined = departmentId;
  const seen = new Set<string>();
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    const dept = byId.get(current)!;
    path.unshift(dept);
    current = dept.parentId;
  }
  return path;
}

/** Walk requester department (then parents) until a head is found. */
export function resolveDepartmentHead(
  departments: OrgDepartment[],
  people: OrgPerson[],
  requester: OrgPerson | undefined,
): OrgPerson | undefined {
  if (!requester?.departmentId) return undefined;
  const byId = new Map(departments.map((d) => [d.id, d]));
  let current: string | null | undefined = requester.departmentId;
  const seen = new Set<string>();
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    const dept = byId.get(current)!;
    if (dept.headUserId) {
      const head = people.find((p) => p.id === dept.headUserId);
      if (head) return head;
    }
    current = dept.parentId;
  }
  return undefined;
}
