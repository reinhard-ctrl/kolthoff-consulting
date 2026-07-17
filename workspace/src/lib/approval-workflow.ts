export interface ApprovalField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'file';
  required?: boolean;
  options?: string[];
}

export type ApprovalMode = 'any' | 'all';

export interface FlowStep {
  id: string;
  type: 'approval' | 'notify';
  label: string;
  assigneeType?: 'user' | 'role' | 'any_admin';
  assigneeId?: string;
  role?: string;
  /** Parallel approvers: any one (default) or all assigned must approve */
  approvalMode?: ApprovalMode;
}

export interface ApprovalAttachment {
  name: string;
  url: string;
  uploadedAt: number;
  uploadedBy: string;
}

export interface ApprovalTemplate {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  fields: ApprovalField[];
  flowSteps: FlowStep[];
}

export interface StepHistoryEntry {
  stepId: string;
  stepLabel: string;
  actorId: string;
  action: 'submit' | 'approve' | 'reject' | 'comment' | 'withdraw' | 'delegate' | 'notify';
  comment?: string;
  at: number;
  meta?: Record<string, unknown>;
}

export interface ApprovalRequest {
  id: string;
  templateId: string;
  requesterId: string;
  requesterFirebaseUid?: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  formData: Record<string, unknown>;
  currentStepIndex: number;
  currentAssigneeIds?: string[];
  currentAssigneeFirebaseUids?: string[];
  currentStepLabel?: string;
  currentApprovalMode?: ApprovalMode;
  /** userId → approval stamp for all-of steps */
  stepApprovals?: Record<string, { at: number; comment?: string }>;
  stepHistory?: StepHistoryEntry[];
  attachments?: ApprovalAttachment[];
  watcherIds?: string[];
  dueAt?: number | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface TenantUserRow {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  departmentId?: string;
  firebaseUid?: string;
}

export function resolveStepAssignees(
  step: FlowStep | undefined,
  users: TenantUserRow[],
  requesterId: string,
): { ids: string[]; firebaseUids: string[]; stepLabel: string } {
  if (!step) {
    return { ids: [], firebaseUids: [], stepLabel: 'Complete' };
  }

  const admins = users.filter((u) => u.role === 'admin' || u.role === 'kolthoff_admin');
  let matched: TenantUserRow[] = [];

  switch (step.assigneeType) {
    case 'user':
      matched = users.filter((u) => u.id === step.assigneeId);
      break;
    case 'role':
      matched = users.filter((u) => u.role === step.role);
      break;
    case 'any_admin':
    default:
      matched = admins.length > 0 ? admins : users.filter((u) => u.id !== requesterId);
      break;
  }

  if (matched.length === 0 && admins.length > 0) {
    matched = admins;
  }

  return {
    ids: matched.map((u) => u.id),
    firebaseUids: matched
      .map((u) => u.firebaseUid)
      .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0),
    stepLabel: step.label,
  };
}

/** Skip notify-only steps by recording notify history and advancing until an approval step or end. */
export function advancePastNotifySteps(
  template: ApprovalTemplate,
  users: TenantUserRow[],
  requesterId: string,
  fromIndex: number,
  history: StepHistoryEntry[],
  actorId: string,
): {
  nextIndex: number;
  assignees: { ids: string[]; firebaseUids: string[]; stepLabel: string };
  stepHistory: StepHistoryEntry[];
  completed: boolean;
  notifyTargets: { step: FlowStep; ids: string[] }[];
} {
  let index = fromIndex;
  const stepHistory = [...history];
  const notifyTargets: { step: FlowStep; ids: string[] }[] = [];
  const now = Date.now();

  while (index < template.flowSteps.length) {
    const step = template.flowSteps[index];
    if (step.type !== 'notify') {
      const assignees = resolveStepAssignees(step, users, requesterId);
      return {
        nextIndex: index,
        assignees,
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
      comment: `Notified ${targets.ids.length || 0} recipient(s)`,
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

export function buildInitialRequest(
  id: string,
  template: ApprovalTemplate,
  requesterId: string,
  formData: Record<string, unknown>,
  users: TenantUserRow[],
  extras?: {
    attachments?: ApprovalAttachment[];
    watcherIds?: string[];
    dueAt?: number | null;
    requesterFirebaseUid?: string;
  },
): Omit<ApprovalRequest, 'id'> & { id: string } {
  const now = Date.now();
  const requester = users.find((u) => u.id === requesterId);
  const requesterFirebaseUid = extras?.requesterFirebaseUid || requester?.firebaseUid;
  const submitHistory: StepHistoryEntry[] = [
    {
      stepId: 'submit',
      stepLabel: 'Submitted',
      actorId: requesterId,
      action: 'submit',
      at: now,
    },
  ];

  const advanced = advancePastNotifySteps(template, users, requesterId, 0, submitHistory, requesterId);

  if (advanced.completed) {
    return {
      id,
      templateId: template.id,
      requesterId,
      requesterFirebaseUid,
      status: 'approved',
      formData,
      currentStepIndex: advanced.nextIndex,
      currentAssigneeIds: [],
      currentAssigneeFirebaseUids: [],
      currentStepLabel: 'Approved',
      currentApprovalMode: 'any',
      stepApprovals: {},
      stepHistory: advanced.stepHistory,
      attachments: extras?.attachments || [],
      watcherIds: extras?.watcherIds || [],
      dueAt: extras?.dueAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  const step = template.flowSteps[advanced.nextIndex];
  return {
    id,
    templateId: template.id,
    requesterId,
    requesterFirebaseUid,
    status: 'pending',
    formData,
    currentStepIndex: advanced.nextIndex,
    currentAssigneeIds: advanced.assignees.ids,
    currentAssigneeFirebaseUids: advanced.assignees.firebaseUids,
    currentStepLabel: advanced.assignees.stepLabel,
    currentApprovalMode: step?.approvalMode || 'any',
    stepApprovals: {},
    stepHistory: advanced.stepHistory,
    attachments: extras?.attachments || [],
    watcherIds: extras?.watcherIds || [],
    dueAt: extras?.dueAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildDecisionUpdate(
  request: ApprovalRequest,
  template: ApprovalTemplate,
  users: TenantUserRow[],
  actorId: string,
  decision: 'approve' | 'reject',
  comment?: string,
): Partial<ApprovalRequest> & { _notifyTargets?: { step: FlowStep; ids: string[] }[] } {
  const now = Date.now();
  const step = template.flowSteps[request.currentStepIndex];
  const historyEntry: StepHistoryEntry = {
    stepId: step?.id || `step-${request.currentStepIndex}`,
    stepLabel: step?.label || request.currentStepLabel || 'Approval',
    actorId,
    action: decision,
    comment: comment?.trim() || undefined,
    at: now,
  };
  const stepHistory = [...(request.stepHistory || []), historyEntry];

  if (decision === 'reject') {
    return {
      status: 'rejected',
      currentAssigneeIds: [],
      currentAssigneeFirebaseUids: [],
      currentStepLabel: 'Rejected',
      stepApprovals: {},
      stepHistory,
      updatedAt: now,
    };
  }

  const mode: ApprovalMode = request.currentApprovalMode || step?.approvalMode || 'any';
  const assignees = request.currentAssigneeIds || [];

  if (mode === 'all' && assignees.length > 1) {
    const stepApprovals = {
      ...(request.stepApprovals || {}),
      [actorId]: { at: now, comment: comment?.trim() || undefined },
    };
    const allDone = assignees.every((id) => Boolean(stepApprovals[id]));
    if (!allDone) {
      return {
        status: 'pending',
        stepApprovals,
        stepHistory,
        updatedAt: now,
      };
    }
  }

  const nextIndex = request.currentStepIndex + 1;
  const advanced = advancePastNotifySteps(
    template,
    users,
    request.requesterId,
    nextIndex,
    stepHistory,
    actorId,
  );

  if (advanced.completed) {
    return {
      status: 'approved',
      currentStepIndex: advanced.nextIndex,
      currentAssigneeIds: [],
      currentAssigneeFirebaseUids: [],
      currentStepLabel: 'Approved',
      currentApprovalMode: 'any',
      stepApprovals: {},
      stepHistory: advanced.stepHistory,
      updatedAt: now,
      _notifyTargets: advanced.notifyTargets,
    };
  }

  const nextStep = template.flowSteps[advanced.nextIndex];
  return {
    status: 'pending',
    currentStepIndex: advanced.nextIndex,
    currentAssigneeIds: advanced.assignees.ids,
    currentAssigneeFirebaseUids: advanced.assignees.firebaseUids,
    currentStepLabel: advanced.assignees.stepLabel,
    currentApprovalMode: nextStep?.approvalMode || 'any',
    stepApprovals: {},
    stepHistory: advanced.stepHistory,
    updatedAt: now,
    _notifyTargets: advanced.notifyTargets,
  };
}

export function buildWithdrawUpdate(
  request: ApprovalRequest,
  actorId: string,
  comment?: string,
): Partial<ApprovalRequest> {
  const now = Date.now();
  return {
    status: 'withdrawn',
    currentAssigneeIds: [],
    currentAssigneeFirebaseUids: [],
    currentStepLabel: 'Withdrawn',
    stepApprovals: {},
    stepHistory: [
      ...(request.stepHistory || []),
      {
        stepId: `step-${request.currentStepIndex}`,
        stepLabel: request.currentStepLabel || 'Withdrawn',
        actorId,
        action: 'withdraw',
        comment: comment?.trim() || undefined,
        at: now,
      },
    ],
    updatedAt: now,
  };
}

export function buildCommentUpdate(
  request: ApprovalRequest,
  actorId: string,
  comment: string,
): Partial<ApprovalRequest> {
  const now = Date.now();
  return {
    stepHistory: [
      ...(request.stepHistory || []),
      {
        stepId: `step-${request.currentStepIndex}`,
        stepLabel: request.currentStepLabel || 'Comment',
        actorId,
        action: 'comment',
        comment: comment.trim(),
        at: now,
      },
    ],
    updatedAt: now,
  };
}

export function buildDelegateUpdate(
  request: ApprovalRequest,
  actorId: string,
  toUser: TenantUserRow,
  comment?: string,
): Partial<ApprovalRequest> {
  const now = Date.now();
  const ids = [...new Set([...(request.currentAssigneeIds || []).filter((id) => id !== actorId), toUser.id])];
  const firebaseUids = [
    ...new Set(
      [
        ...(request.currentAssigneeFirebaseUids || []),
        toUser.firebaseUid,
      ].filter((uid): uid is string => typeof uid === 'string' && uid.length > 0),
    ),
  ];
  // Drop actor's firebase uid if they are no longer assignee
  const remainingUsers = ids; // uids recomputed from toUser + others kept loosely
  const keptUids = firebaseUids.filter((uid) => uid === toUser.firebaseUid || remainingUsers.length > 0);

  return {
    currentAssigneeIds: ids,
    currentAssigneeFirebaseUids: keptUids.length ? keptUids : toUser.firebaseUid ? [toUser.firebaseUid] : [],
    stepHistory: [
      ...(request.stepHistory || []),
      {
        stepId: `step-${request.currentStepIndex}`,
        stepLabel: request.currentStepLabel || 'Delegated',
        actorId,
        action: 'delegate',
        comment: comment?.trim() || `Delegated to ${toUser.name || toUser.email || toUser.id}`,
        at: now,
        meta: { toUserId: toUser.id },
      },
    ],
    updatedAt: now,
  };
}

export function canActOnRequest(request: ApprovalRequest, userId: string, firebaseUid?: string): boolean {
  if (request.status !== 'pending') return false;
  if (request.currentAssigneeIds?.includes(userId)) return true;
  if (firebaseUid && request.currentAssigneeFirebaseUids?.includes(firebaseUid)) return true;
  return false;
}

export function canWithdrawRequest(request: ApprovalRequest, userId: string): boolean {
  return request.status === 'pending' && request.requesterId === userId;
}

export function isOverdue(request: ApprovalRequest): boolean {
  return request.status === 'pending' && typeof request.dueAt === 'number' && request.dueAt < Date.now();
}

export function statusBadgeClass(status: string): string {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-rose-100 text-rose-800';
  if (status === 'withdrawn') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-100 text-amber-800';
}

export function enabledTemplates(templates: ApprovalTemplate[]): ApprovalTemplate[] {
  return templates.filter((t) => t.enabled !== false);
}
