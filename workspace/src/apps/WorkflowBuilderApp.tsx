import { useMemo, useState } from 'react';
import { deleteDoc, setDoc } from 'firebase/firestore';
import { logAudit, tenantCol, tenantDoc } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import {
  type ApprovalField,
  type ApprovalTemplate,
  type AssigneeType,
  type FlowStep,
  type TenantUserRow,
  assigneeTypeLabel,
} from '../lib/approval-workflow';
import { collectOrgRoles, type OrgDepartment, type OrgPerson } from '../lib/org-structure';

const ASSIGNEE_OPTIONS: { id: AssigneeType; hint: string }[] = [
  { id: 'manager', hint: 'Requester’s direct manager from the org chart' },
  { id: 'department_head', hint: 'Head of the requester’s department (walks up parents)' },
  { id: 'org_role', hint: 'Everyone with a matching org role / job title' },
  { id: 'user', hint: 'A specific workspace member' },
  { id: 'role', hint: 'ACL role (admin / user)' },
  { id: 'any_admin', hint: 'Any workspace admin' },
];

function emptyTemplate(): ApprovalTemplate {
  return {
    id: `tpl_${Date.now().toString(36)}`,
    name: 'New approval workflow',
    description: '',
    enabled: true,
    fields: [
      { id: 'summary', label: 'Summary', type: 'textarea', required: true },
    ],
    flowSteps: [
      { id: 'step_mgr', type: 'approval', label: 'Manager approval', assigneeType: 'manager', approvalMode: 'any' },
    ],
  };
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-1 text-slate-300" aria-hidden>
      <div className="w-px h-4 bg-slate-300" />
      <div className="w-2 h-2 rounded-full bg-slate-300" />
      <div className="w-px h-4 bg-slate-300" />
    </div>
  );
}

function FlowNode({
  title,
  subtitle,
  tone,
  active,
  onClick,
}: {
  title: string;
  subtitle: string;
  tone: 'start' | 'approval' | 'notify' | 'end';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === 'start' ? 'border-slate-800 bg-slate-900 text-white'
      : tone === 'end' ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
        : tone === 'notify' ? 'border-sky-300 bg-sky-50 text-sky-900'
          : 'border-brandTeal-400 bg-white text-slate-900';

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full max-w-sm mx-auto rounded-xl border-2 px-4 py-3 text-left shadow-sm transition ${toneClass} ${
        active ? 'ring-2 ring-brandTeal-500 ring-offset-2' : ''
      } ${onClick ? 'hover:shadow-md' : ''}`}
    >
      <div className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">
        {tone === 'start' ? 'Start' : tone === 'end' ? 'End' : tone === 'notify' ? 'Notify' : 'Approval'}
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs opacity-80 mt-0.5">{subtitle}</div>
    </Tag>
  );
}

export default function WorkflowBuilderApp({ canEdit }: { canEdit: boolean }) {
  const { data: templates } = useFirestoreCollection<ApprovalTemplate>(tenantCol('core_templates'));
  const { data: usersRaw } = useFirestoreCollection<TenantUserRow>(tenantCol('core_users'));
  const { data: departments } = useFirestoreCollection<OrgDepartment>(tenantCol('core_departments'));
  const users = useMemo(() => usersRaw as OrgPerson[], [usersRaw]);
  const orgRoles = useMemo(() => collectOrgRoles(users), [users]);

  const [draft, setDraft] = useState<ApprovalTemplate | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [panel, setPanel] = useState<'flow' | 'form'>('flow');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const openNew = () => {
    setDraft(emptyTemplate());
    setSelectedStep(0);
    setPanel('flow');
    setError('');
    setOk('');
  };

  const openEdit = (tmpl: ApprovalTemplate) => {
    setDraft(JSON.parse(JSON.stringify(tmpl)) as ApprovalTemplate);
    setSelectedStep(tmpl.flowSteps.length ? 0 : null);
    setPanel('flow');
    setError('');
    setOk('');
  };

  const updateStep = (index: number, patch: Partial<FlowStep>) => {
    if (!draft) return;
    const flowSteps = [...draft.flowSteps];
    flowSteps[index] = { ...flowSteps[index], ...patch };
    setDraft({ ...draft, flowSteps });
  };

  const updateField = (index: number, patch: Partial<ApprovalField>) => {
    if (!draft) return;
    const fields = [...draft.fields];
    fields[index] = { ...fields[index], ...patch };
    setDraft({ ...draft, fields });
  };

  const addStep = (type: 'approval' | 'notify') => {
    if (!draft) return;
    const id = `step_${Date.now().toString(36)}`;
    const step: FlowStep = type === 'notify'
      ? { id, type: 'notify', label: 'Notify stakeholders', assigneeType: 'department_head' }
      : { id, type: 'approval', label: 'Approval', assigneeType: 'manager', approvalMode: 'any' };
    setDraft({ ...draft, flowSteps: [...draft.flowSteps, step] });
    setSelectedStep(draft.flowSteps.length);
    setPanel('flow');
  };

  const removeStep = (index: number) => {
    if (!draft) return;
    const flowSteps = draft.flowSteps.filter((_, i) => i !== index);
    setDraft({ ...draft, flowSteps });
    setSelectedStep(flowSteps.length ? Math.max(0, index - 1) : null);
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    if (!draft) return;
    const next = index + dir;
    if (next < 0 || next >= draft.flowSteps.length) return;
    const flowSteps = [...draft.flowSteps];
    const [item] = flowSteps.splice(index, 1);
    flowSteps.splice(next, 0, item);
    setDraft({ ...draft, flowSteps });
    setSelectedStep(next);
  };

  const save = async () => {
    if (!draft || !canEdit) return;
    if (!draft.name.trim()) {
      setError('Workflow name is required.');
      return;
    }
    if (!draft.flowSteps.length) {
      setError('Add at least one approval or notify step.');
      return;
    }
    setBusy(true);
    setError('');
    setOk('');
    try {
      const payload = {
        ...draft,
        name: draft.name.trim(),
        description: draft.description?.trim() || '',
        updatedAt: Date.now(),
      };
      await setDoc(tenantDoc('core_templates', draft.id), payload, { merge: true });
      await logAudit('approval_workflow_save', { templateId: draft.id, name: payload.name });
      setOk('Workflow saved. It is available in Approval Center.');
      setDraft(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const removeTemplate = async (id: string) => {
    if (!canEdit || !window.confirm('Delete this approval workflow?')) return;
    await deleteDoc(tenantDoc('core_templates', id));
    if (draft?.id === id) setDraft(null);
  };

  const selected = selectedStep != null && draft ? draft.flowSteps[selectedStep] : null;

  if (!draft) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="ws-page">
          <div className="flex flex-wrap justify-between gap-3 mb-5">
            <div>
              <h1 className="ws-title">Approval workflows</h1>
              <p className="ws-subtitle">
                Build Lark-style approval flows: form fields + sequential approvers resolved from your org chart.
              </p>
            </div>
            {canEdit && (
              <button type="button" onClick={openNew} className="ws-btn-primary">+ New workflow</button>
            )}
          </div>
          {!canEdit && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
              View only. Workspace admins can design workflows.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => openEdit(tmpl)}
                className="ws-panel p-4 text-left hover:border-brandTeal-400 transition"
              >
                <div className="font-semibold text-slate-900">{tmpl.name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {tmpl.fields?.length || 0} fields · {tmpl.flowSteps?.length || 0} steps
                  {tmpl.enabled === false ? ' · disabled' : ''}
                </div>
                {tmpl.description && <p className="text-xs text-slate-500 mt-2">{tmpl.description}</p>}
                <div className="flex flex-wrap gap-1 mt-3">
                  {(tmpl.flowSteps || []).slice(0, 4).map((s) => (
                    <span key={s.id} className="ws-chip bg-slate-100 text-slate-600">
                      {s.label}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {templates.length === 0 && (
            <p className="text-sm text-slate-400 italic mt-6">No workflows yet. Create one or deploy blueprints from Workspace Admin.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="border-b bg-white/90 px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => setDraft(null)} className="text-sm text-brandTeal-600 shrink-0">← Back</button>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            disabled={!canEdit}
            className="ws-input font-semibold max-w-md"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPanel('flow')} className={`ws-tab ${panel === 'flow' ? 'ws-tab-active' : ''}`}>Flow</button>
          <button type="button" onClick={() => setPanel('form')} className={`ws-tab ${panel === 'form' ? 'ws-tab-active' : ''}`}>Form</button>
          {canEdit && (
            <>
              <button type="button" onClick={save} disabled={busy} className="ws-btn-primary disabled:opacity-50">
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => removeTemplate(draft.id)} className="ws-btn-secondary text-rose-600">
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {(error || ok) && (
        <div className="px-4 py-2 text-sm border-b bg-white">
          {error && <span className="text-rose-600">{error}</span>}
          {ok && <span className="text-emerald-700">{ok}</span>}
        </div>
      )}

      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        <div className="overflow-y-auto p-6 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.08),_transparent_50%)]">
          {panel === 'flow' ? (
            <div className="max-w-md mx-auto">
              <FlowNode title="Submit request" subtitle="Requester fills the form" tone="start" />
              {draft.flowSteps.map((step, index) => (
                <div key={step.id}>
                  <Connector />
                  <FlowNode
                    title={step.label || `Step ${index + 1}`}
                    subtitle={`${assigneeTypeLabel(step.assigneeType)}${
                      step.assigneeType === 'org_role' && step.orgRole ? `: ${step.orgRole}` : ''
                    }${step.approvalMode === 'all' ? ' · all of' : ''}`}
                    tone={step.type === 'notify' ? 'notify' : 'approval'}
                    active={selectedStep === index}
                    onClick={() => setSelectedStep(index)}
                  />
                </div>
              ))}
              <Connector />
              <FlowNode title="Complete" subtitle="Approved / notified" tone="end" />

              {canEdit && (
                <div className="flex justify-center gap-2 mt-6">
                  <button type="button" onClick={() => addStep('approval')} className="ws-btn-primary text-xs">+ Approval</button>
                  <button type="button" onClick={() => addStep('notify')} className="ws-btn-secondary text-xs">+ Notify</button>
                </div>
              )}

              {departments.length === 0 && (
                <p className="text-xs text-amber-700 text-center mt-6">
                  Tip: set departments and department heads under Organization so “Department head” routing works.
                </p>
              )}
            </div>
          ) : (
            <div className="max-w-xl mx-auto space-y-3">
              <div>
                <label className="text-xs text-slate-500">Description</label>
                <input
                  value={draft.description || ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  disabled={!canEdit}
                  className="ws-input mt-1"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={draft.enabled !== false}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                />
                Enabled for requesters
              </label>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Form fields</h2>
                {canEdit && (
                  <button
                    type="button"
                    className="text-xs text-brandTeal-600"
                    onClick={() => setDraft({
                      ...draft,
                      fields: [...draft.fields, { id: `f_${Date.now()}`, label: 'New field', type: 'text', required: false }],
                    })}
                  >
                    + Field
                  </button>
                )}
              </div>
              {draft.fields.map((field, index) => (
                <div key={field.id} className="ws-panel p-3 grid grid-cols-12 gap-2">
                  <input
                    value={field.label}
                    disabled={!canEdit}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    className="ws-input col-span-5"
                  />
                  <select
                    value={field.type}
                    disabled={!canEdit}
                    onChange={(e) => updateField(index, { type: e.target.value as ApprovalField['type'] })}
                    className="ws-input col-span-3"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Select</option>
                    <option value="date">Date</option>
                    <option value="file">File note</option>
                  </select>
                  <label className="col-span-2 flex items-center gap-1 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      disabled={!canEdit}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                    />
                    Req
                  </label>
                  {canEdit && (
                    <button
                      type="button"
                      className="col-span-2 text-xs text-rose-600"
                      onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })}
                    >
                      Remove
                    </button>
                  )}
                  {field.type === 'select' && (
                    <input
                      value={(field.options || []).join(', ')}
                      disabled={!canEdit}
                      onChange={(e) => updateField(index, {
                        options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })}
                      className="ws-input col-span-12"
                      placeholder="Options, comma-separated"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="border-l bg-white overflow-y-auto p-4">
          {selected && selectedStep != null ? (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-800">Step settings</h2>
              <div>
                <label className="text-[11px] text-slate-500">Label</label>
                <input
                  value={selected.label}
                  disabled={!canEdit}
                  onChange={(e) => updateStep(selectedStep, { label: e.target.value })}
                  className="ws-input mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Step type</label>
                <select
                  value={selected.type}
                  disabled={!canEdit}
                  onChange={(e) => updateStep(selectedStep, { type: e.target.value as FlowStep['type'] })}
                  className="ws-input mt-1"
                >
                  <option value="approval">Approval</option>
                  <option value="notify">Notify only</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Assignee</label>
                <select
                  value={selected.assigneeType || 'any_admin'}
                  disabled={!canEdit}
                  onChange={(e) => updateStep(selectedStep, { assigneeType: e.target.value as AssigneeType })}
                  className="ws-input mt-1"
                >
                  {ASSIGNEE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{assigneeTypeLabel(opt.id)}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {ASSIGNEE_OPTIONS.find((o) => o.id === (selected.assigneeType || 'any_admin'))?.hint}
                </p>
              </div>

              {selected.assigneeType === 'org_role' && (
                <div>
                  <label className="text-[11px] text-slate-500">Org role</label>
                  <input
                    list="wf-org-roles"
                    value={selected.orgRole || ''}
                    disabled={!canEdit}
                    onChange={(e) => updateStep(selectedStep, { orgRole: e.target.value })}
                    className="ws-input mt-1"
                    placeholder="e.g. Finance Approver"
                  />
                  <datalist id="wf-org-roles">
                    {orgRoles.map((r) => <option key={r} value={r} />)}
                  </datalist>
                </div>
              )}

              {selected.assigneeType === 'role' && (
                <div>
                  <label className="text-[11px] text-slate-500">ACL role</label>
                  <select
                    value={selected.role || 'admin'}
                    disabled={!canEdit}
                    onChange={(e) => updateStep(selectedStep, { role: e.target.value })}
                    className="ws-input mt-1"
                  >
                    <option value="admin">admin</option>
                    <option value="user">user</option>
                    <option value="kolthoff_admin">kolthoff_admin</option>
                  </select>
                </div>
              )}

              {selected.assigneeType === 'user' && (
                <div>
                  <label className="text-[11px] text-slate-500">Person</label>
                  <select
                    value={selected.assigneeId || ''}
                    disabled={!canEdit}
                    onChange={(e) => updateStep(selectedStep, { assigneeId: e.target.value })}
                    className="ws-input mt-1"
                  >
                    <option value="">Select…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>
                    ))}
                  </select>
                </div>
              )}

              {selected.type === 'approval' && (
                <div>
                  <label className="text-[11px] text-slate-500">When multiple people match</label>
                  <select
                    value={selected.approvalMode || 'any'}
                    disabled={!canEdit}
                    onChange={(e) => updateStep(selectedStep, { approvalMode: e.target.value as 'any' | 'all' })}
                    className="ws-input mt-1"
                  >
                    <option value="any">Any one can approve</option>
                    <option value="all">All must approve</option>
                  </select>
                </div>
              )}

              {canEdit && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <button type="button" onClick={() => moveStep(selectedStep, -1)} className="ws-btn-secondary text-xs">↑</button>
                  <button type="button" onClick={() => moveStep(selectedStep, 1)} className="ws-btn-secondary text-xs">↓</button>
                  <button type="button" onClick={() => removeStep(selectedStep)} className="ws-btn-secondary text-xs text-rose-600">
                    Remove step
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Select a step on the canvas to configure assignees.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
