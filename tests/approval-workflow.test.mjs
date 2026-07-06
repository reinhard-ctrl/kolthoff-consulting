/**
 * Approval workflow assignee resolution — no Firebase required.
 */
import assert from 'node:assert/strict';

function resolveStepAssignees(step, users, requesterId) {
  if (!step || step.type === 'notify') {
    return { ids: [], firebaseUids: [], stepLabel: step?.label || 'Complete' };
  }
  const admins = users.filter((u) => u.role === 'admin' || u.role === 'kolthoff_admin');
  let matched = [];
  switch (step.assigneeType) {
    case 'user':
      matched = users.filter((u) => u.id === step.assigneeId);
      break;
    case 'role':
      matched = users.filter((u) => u.role === step.role);
      break;
    default:
      matched = admins.length > 0 ? admins : users.filter((u) => u.id !== requesterId);
  }
  if (matched.length === 0 && admins.length > 0) matched = admins;
  return {
    ids: matched.map((u) => u.id),
    firebaseUids: matched.map((u) => u.firebaseUid).filter(Boolean),
    stepLabel: step.label,
  };
}

const users = [
  { id: 'u_admin', role: 'admin', firebaseUid: 'fb_admin' },
  { id: 'u_user', role: 'user', firebaseUid: 'fb_user' },
];

const step = { id: 's1', type: 'approval', label: 'Manager', assigneeType: 'any_admin' };
const result = resolveStepAssignees(step, users, 'u_user');

assert.deepEqual(result.ids, ['u_admin']);
assert.deepEqual(result.firebaseUids, ['fb_admin']);
console.log('approval-workflow.test.mjs OK');
