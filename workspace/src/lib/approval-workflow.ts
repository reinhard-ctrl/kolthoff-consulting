export interface ApprovalField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'date';
  required?: boolean;
  options?: string[];
}

export interface FlowStep {
  id: string;
  type: 'approval' | 'notify';
  label: string;
  assigneeType?: 'user' | 'role' | 'any_admin';
  assigneeId?: string;
  role?: string;
}

export interface ApprovalTemplate {
  id: string;
  name: string;
  fields: ApprovalField[];
  flowSteps: FlowStep[];
}

export interface StepHistoryEntry {
  stepId: string;
  stepLabel: string;
  actorId: string;
  action: 'submit' | 'approve' | 'reject' | 'comment';
  comment?: string;
  at: number;
}

export interface ApprovalRequest {
  id: string;
  templateId: string;
  requesterId: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  formData: Record<string, unknown>;
  currentStepIndex: number;
  currentAssigneeIds?: string[];
  currentAssigneeFirebaseUids?: string[];
  currentStepLabel?: string;
  stepHistory?: StepHistoryEntry[];
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
  if (!step || step.type === 'notify') {
    return { ids: [], firebaseUids: [], stepLabel: step?.label || 'Complete' };
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

  const ids = matched.map((u) => u.id);
  const firebaseUids = matched
    .map((u) => u.firebaseUid)
    .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0);

  return { ids, firebaseUids, stepLabel: step.label };
}

export function buildInitialRequest(
  id: string,
  template: ApprovalTemplate,
  requesterId: string,
  formData: Record<string, unknown>,
  users: TenantUserRow[],
): Omit<ApprovalRequest, 'id'> & { id: string } {
  const step = template.flowSteps[0];
  const assignees = resolveStepAssignees(step, users, requesterId);
  const now = Date.now();

  return {
    id,
    templateId: template.id,
    requesterId,
    status: 'pending',
    formData,
    currentStepIndex: 0,
    currentAssigneeIds: assignees.ids,
    currentAssigneeFirebaseUids: assignees.firebaseUids,
    currentStepLabel: assignees.stepLabel,
    stepHistory: [
      {
        stepId: step?.id || 'submit',
        stepLabel: 'Submitted',
        actorId: requesterId,
        action: 'submit',
        at: now,
      },
    ],
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
): Partial<ApprovalRequest> {
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
      stepHistory,
      updatedAt: now,
    };
  }

  const nextIndex = request.currentStepIndex + 1;
  if (nextIndex >= template.flowSteps.length) {
    return {
      status: 'approved',
      currentAssigneeIds: [],
      currentAssigneeFirebaseUids: [],
      currentStepLabel: 'Approved',
      stepHistory,
      updatedAt: now,
    };
  }

  const nextStep = template.flowSteps[nextIndex];
  const assignees = resolveStepAssignees(nextStep, users, request.requesterId);

  return {
    status: 'pending',
    currentStepIndex: nextIndex,
    currentAssigneeIds: assignees.ids,
    currentAssigneeFirebaseUids: assignees.firebaseUids,
    currentStepLabel: assignees.stepLabel,
    stepHistory,
    updatedAt: now,
  };
}

export function canActOnRequest(request: ApprovalRequest, userId: string, firebaseUid?: string): boolean {
  if (request.status !== 'pending') return false;
  if (request.currentAssigneeIds?.includes(userId)) return true;
  if (firebaseUid && request.currentAssigneeFirebaseUids?.includes(firebaseUid)) return true;
  return false;
}

export function statusBadgeClass(status: string): string {
  if (status === 'approved') return 'bg-green-100 text-green-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  if (status === 'withdrawn') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-100 text-amber-700';
}
