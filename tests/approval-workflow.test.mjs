/**
 * Approval workflow — org-aware assignee resolution + notify / all-of.
 */
import assert from 'node:assert/strict';

function resolveDepartmentHeadUser(departments, users, requester) {
  if (!requester?.departmentId) return undefined;
  const byId = new Map(departments.map((d) => [d.id, d]));
  let current = requester.departmentId;
  const seen = new Set();
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    const dept = byId.get(current);
    if (dept.headUserId) {
      const head = users.find((u) => u.id === dept.headUserId);
      if (head) return head;
    }
    current = dept.parentId;
  }
  return undefined;
}

function resolveStepAssignees(step, users, requesterId, departments = []) {
  if (!step) return { ids: [], firebaseUids: [], stepLabel: 'Complete' };
  const admins = users.filter((u) => u.role === 'admin' || u.role === 'kolthoff_admin');
  const requester = users.find((u) => u.id === requesterId);
  let matched = [];
  switch (step.assigneeType) {
    case 'manager':
      if (requester?.managerId) matched = users.filter((u) => u.id === requester.managerId);
      break;
    case 'department_head': {
      const head = resolveDepartmentHeadUser(departments, users, requester);
      matched = head ? [head] : [];
      break;
    }
    case 'org_role': {
      const wanted = (step.orgRole || step.role || '').trim().toLowerCase();
      matched = users.filter((u) => {
        const orgRole = (u.orgRole || '').trim().toLowerCase();
        const jobTitle = (u.jobTitle || '').trim().toLowerCase();
        return wanted && (orgRole === wanted || jobTitle === wanted);
      });
      break;
    }
    case 'user':
      matched = users.filter((u) => u.id === step.assigneeId);
      break;
    case 'role':
      matched = users.filter((u) => u.role === step.role);
      break;
    default:
      matched = admins.length > 0 ? admins : users.filter((u) => u.id !== requesterId);
  }
  if (matched.length === 0 && step.assigneeType === 'manager') {
    const head = resolveDepartmentHeadUser(departments, users, requester);
    if (head) matched = [head];
  }
  if (matched.length === 0 && admins.length > 0) matched = admins;
  return {
    ids: matched.map((u) => u.id),
    firebaseUids: matched.map((u) => u.firebaseUid).filter(Boolean),
    stepLabel: step.label,
  };
}

const users = [
  { id: 'u_ceo', role: 'admin', firebaseUid: 'fb_ceo', orgRole: 'CEO' },
  { id: 'u_mgr', role: 'user', firebaseUid: 'fb_mgr', orgRole: 'Manager', departmentId: 'dept_ops', managerId: 'u_ceo' },
  { id: 'u_fin', role: 'user', firebaseUid: 'fb_fin', orgRole: 'Finance Approver', departmentId: 'dept_ops' },
  {
    id: 'u_user',
    role: 'user',
    firebaseUid: 'fb_user',
    jobTitle: 'Analyst',
    departmentId: 'dept_ops',
    managerId: 'u_mgr',
  },
];

const departments = [
  { id: 'dept_ops', name: 'Operations', parentId: null, headUserId: 'u_ceo' },
];

assert.deepEqual(
  resolveStepAssignees({ id: 's', type: 'approval', label: 'Mgr', assigneeType: 'manager' }, users, 'u_user', departments).ids,
  ['u_mgr'],
);

assert.deepEqual(
  resolveStepAssignees(
    { id: 's', type: 'approval', label: 'Head', assigneeType: 'department_head' },
    users,
    'u_user',
    departments,
  ).ids,
  ['u_ceo'],
);

assert.deepEqual(
  resolveStepAssignees(
    { id: 's', type: 'approval', label: 'Fin', assigneeType: 'org_role', orgRole: 'Finance Approver' },
    users,
    'u_user',
    departments,
  ).ids,
  ['u_fin'],
);

// manager missing → fall back to department head
const orphan = { ...users.find((u) => u.id === 'u_user'), managerId: null, id: 'u_orphan' };
const users2 = [...users, orphan];
assert.deepEqual(
  resolveStepAssignees({ id: 's', type: 'approval', label: 'Mgr', assigneeType: 'manager' }, users2, 'u_orphan', departments).ids,
  ['u_ceo'],
);

console.log('approval-workflow.test.mjs OK');
