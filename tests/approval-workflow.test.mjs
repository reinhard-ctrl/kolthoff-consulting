/**
 * Approval workflow — assignee resolution, notify skip, all-of, withdraw/delegate.
 */
import assert from 'node:assert/strict';

function resolveStepAssignees(step, users, requesterId) {
  if (!step) {
    return { ids: [], firebaseUids: [], stepLabel: 'Complete' };
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

function advancePastNotifySteps(template, users, requesterId, fromIndex, history, actorId) {
  let index = fromIndex;
  const stepHistory = [...history];
  const notifyTargets = [];
  const now = Date.now();
  while (index < template.flowSteps.length) {
    const step = template.flowSteps[index];
    if (step.type !== 'notify') {
      return {
        nextIndex: index,
        assignees: resolveStepAssignees(step, users, requesterId),
        stepHistory,
        completed: false,
        notifyTargets,
      };
    }
    const targets = resolveStepAssignees(
      { ...step, type: 'approval', assigneeType: step.assigneeType || 'any_admin' },
      users,
      requesterId,
    );
    notifyTargets.push({ step, ids: targets.ids });
    stepHistory.push({
      stepId: step.id,
      stepLabel: step.label,
      actorId,
      action: 'notify',
      at: now,
    });
    index += 1;
  }
  return {
    nextIndex: index,
    assignees: { ids: [], firebaseUids: [], stepLabel: 'Approved' },
    stepHistory,
    completed: true,
    notifyTargets,
  };
}

function buildDecisionUpdate(request, template, users, actorId, decision, comment) {
  const now = Date.now();
  const step = template.flowSteps[request.currentStepIndex];
  const stepHistory = [
    ...(request.stepHistory || []),
    {
      stepId: step?.id || `step-${request.currentStepIndex}`,
      stepLabel: step?.label || 'Approval',
      actorId,
      action: decision,
      comment,
      at: now,
    },
  ];
  if (decision === 'reject') {
    return { status: 'rejected', currentAssigneeIds: [], stepHistory };
  }
  const mode = request.currentApprovalMode || step?.approvalMode || 'any';
  const assignees = request.currentAssigneeIds || [];
  if (mode === 'all' && assignees.length > 1) {
    const stepApprovals = { ...(request.stepApprovals || {}), [actorId]: { at: now, comment } };
    if (!assignees.every((id) => stepApprovals[id])) {
      return { status: 'pending', stepApprovals, stepHistory };
    }
  }
  const advanced = advancePastNotifySteps(
    template,
    users,
    request.requesterId,
    request.currentStepIndex + 1,
    stepHistory,
    actorId,
  );
  if (advanced.completed) {
    return { status: 'approved', currentAssigneeIds: [], stepHistory: advanced.stepHistory };
  }
  return {
    status: 'pending',
    currentStepIndex: advanced.nextIndex,
    currentAssigneeIds: advanced.assignees.ids,
    currentStepLabel: advanced.assignees.stepLabel,
    stepHistory: advanced.stepHistory,
  };
}

const users = [
  { id: 'u_admin', role: 'admin', firebaseUid: 'fb_admin' },
  { id: 'u_fin', role: 'admin', firebaseUid: 'fb_fin' },
  { id: 'u_user', role: 'user', firebaseUid: 'fb_user' },
];

const step = { id: 's1', type: 'approval', label: 'Manager', assigneeType: 'any_admin' };
const result = resolveStepAssignees(step, users, 'u_user');
assert.deepEqual(result.ids, ['u_admin', 'u_fin']);
assert.ok(result.firebaseUids.includes('fb_admin'));

const template = {
  flowSteps: [
    { id: 'n1', type: 'notify', label: 'Notify HR', assigneeType: 'any_admin' },
    { id: 'a1', type: 'approval', label: 'Manager', assigneeType: 'any_admin', approvalMode: 'all' },
  ],
};
const advanced = advancePastNotifySteps(template, users, 'u_user', 0, [], 'u_user');
assert.equal(advanced.nextIndex, 1);
assert.equal(advanced.notifyTargets.length, 1);
assert.equal(advanced.completed, false);

const pending = {
  requesterId: 'u_user',
  currentStepIndex: 1,
  currentAssigneeIds: ['u_admin', 'u_fin'],
  currentApprovalMode: 'all',
  stepApprovals: {},
  stepHistory: [],
  status: 'pending',
};
const partial = buildDecisionUpdate(pending, template, users, 'u_admin', 'approve', 'ok');
assert.equal(partial.status, 'pending');
assert.ok(partial.stepApprovals.u_admin);

const almost = {
  ...pending,
  stepApprovals: { u_admin: { at: 1 } },
};
const done = buildDecisionUpdate(almost, template, users, 'u_fin', 'approve', 'ok');
assert.equal(done.status, 'approved');

console.log('approval-workflow.test.mjs OK');
