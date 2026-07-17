import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, adminAppId } from '../lib/firebase';

export type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'date' | 'file';
export type StepType = 'approval' | 'notify';
export type AssigneeType =
  | 'manager'
  | 'department_head'
  | 'org_role'
  | 'user'
  | 'role'
  | 'any_admin';
export type ApprovalMode = 'any' | 'all';

export interface BlueprintField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
}

export interface BlueprintStep {
  id: string;
  type: StepType;
  label: string;
  assigneeType?: AssigneeType;
  assigneeId?: string;
  role?: string;
  orgRole?: string;
  approvalMode?: ApprovalMode;
}

export interface BlueprintDraft {
  id: string;
  name: string;
  type: string;
  description?: string;
  enabled?: boolean;
  fields: BlueprintField[];
  flowSteps: BlueprintStep[];
}

const ASSIGNEE_LABELS: Record<AssigneeType, string> = {
  manager: 'Direct manager',
  department_head: 'Department head',
  org_role: 'Org role',
  user: 'Specific user id',
  role: 'ACL role',
  any_admin: 'Any admin',
};

const emptyDraft = (): BlueprintDraft => ({
  id: `tpl-${Date.now().toString(36)}`,
  name: '',
  type: 'approval',
  description: '',
  enabled: true,
  fields: [{ id: 'field1', label: 'Details', type: 'textarea', required: true }],
  flowSteps: [{ id: 'step1', type: 'approval', label: 'Manager approval', assigneeType: 'manager', approvalMode: 'any' }],
});

function slugFieldId(label: string, index: number): string {
  const base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return base || `field_${index + 1}`;
}

export default function BlueprintEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Partial<BlueprintDraft> | null;
  onClose: () => void;
  onSaved: (draft: BlueprintDraft) => void;
}) {
  const [draft, setDraft] = useState<BlueprintDraft>(() => ({
    ...emptyDraft(),
    ...initial,
    fields: (initial?.fields as BlueprintField[]) || emptyDraft().fields,
    flowSteps: (initial?.flowSteps as BlueprintStep[]) || emptyDraft().flowSteps,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedStep, setSelectedStep] = useState(0);

  useEffect(() => {
    if (!initial) return;
    setDraft({
      ...emptyDraft(),
      ...initial,
      id: initial.id || emptyDraft().id,
      fields: (initial.fields as BlueprintField[])?.length
        ? (initial.fields as BlueprintField[])
        : emptyDraft().fields,
      flowSteps: (initial.flowSteps as BlueprintStep[])?.length
        ? (initial.flowSteps as BlueprintStep[])
        : emptyDraft().flowSteps,
    });
    setSelectedStep(0);
  }, [initial]);

  const updateField = (index: number, patch: Partial<BlueprintField>) => {
    setDraft((prev) => {
      const fields = [...prev.fields];
      fields[index] = { ...fields[index], ...patch };
      if (patch.label) fields[index].id = slugFieldId(patch.label, index);
      return { ...prev, fields };
    });
  };

  const updateStep = (index: number, patch: Partial<BlueprintStep>) => {
    setDraft((prev) => {
      const flowSteps = [...prev.flowSteps];
      flowSteps[index] = { ...flowSteps[index], ...patch };
      return { ...prev, flowSteps };
    });
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!draft.fields.length || !draft.flowSteps.length) {
      setError('Add at least one field and one flow step.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...draft,
        name: draft.name.trim(),
        description: draft.description?.trim() || '',
        enabled: draft.enabled !== false,
        updatedAt: Date.now(),
      };
      await setDoc(
        doc(db, 'artifacts', adminAppId, 'public', 'data', 'master_templates', draft.id),
        payload,
        { merge: true },
      );
      onSaved(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const step = draft.flowSteps[selectedStep];

  return (
    <div className="fixed inset-0 z-[180] bg-black/70 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-brandNavy-700">
          <div>
            <h2 className="text-lg font-bold text-white">Approval workflow console</h2>
            <p className="text-xs text-slate-400 mt-1">
              Design master templates with org-aware assignees (manager, department head, org role). Deploy to client tenants after saving.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm">Close</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-slate-500">Name</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500">Template ID</label>
              <input
                value={draft.id}
                onChange={(e) => setDraft({ ...draft, id: e.target.value.trim() })}
                className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm font-mono"
                disabled={Boolean(initial?.id)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase text-slate-500">Description</label>
              <input
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="w-full p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm"
              />
            </div>
          </div>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-brandTeal-400 uppercase tracking-wide">Visual flow</h3>
              <button
                type="button"
                onClick={() => {
                  setDraft((prev) => ({
                    ...prev,
                    flowSteps: [...prev.flowSteps, {
                      id: `step_${prev.flowSteps.length + 1}`,
                      type: 'approval',
                      label: 'Approval',
                      assigneeType: 'manager',
                      approvalMode: 'any',
                    }],
                  }));
                  setSelectedStep(draft.flowSteps.length);
                }}
                className="text-xs text-brandTeal-400"
              >
                + Step
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-3 py-1.5 rounded-full text-[11px] bg-slate-800 text-slate-200">Submit</span>
              {draft.flowSteps.map((s, index) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-slate-600">→</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStep(index)}
                    className={`px-3 py-1.5 rounded-full text-[11px] border ${
                      selectedStep === index
                        ? 'bg-brandTeal-500 text-brandNavy-955 border-brandTeal-500 font-bold'
                        : s.type === 'notify'
                          ? 'border-sky-500/40 text-sky-300'
                          : 'border-brandNavy-600 text-slate-300'
                    }`}
                  >
                    {s.label || `Step ${index + 1}`}
                  </button>
                </div>
              ))}
              <span className="text-slate-600">→</span>
              <span className="px-3 py-1.5 rounded-full text-[11px] bg-emerald-900/40 text-emerald-300 border border-emerald-700/40">End</span>
            </div>

            {step && (
              <div className="grid grid-cols-12 gap-2 p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50">
                <input
                  value={step.label}
                  onChange={(e) => updateStep(selectedStep, { label: e.target.value })}
                  className="col-span-4 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                  placeholder="Step label"
                />
                <select
                  value={step.type}
                  onChange={(e) => updateStep(selectedStep, { type: e.target.value as StepType })}
                  className="col-span-2 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                >
                  <option value="approval">Approval</option>
                  <option value="notify">Notify</option>
                </select>
                <select
                  value={step.assigneeType || 'any_admin'}
                  onChange={(e) => updateStep(selectedStep, { assigneeType: e.target.value as AssigneeType })}
                  className="col-span-3 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                >
                  {(Object.keys(ASSIGNEE_LABELS) as AssigneeType[]).map((key) => (
                    <option key={key} value={key}>{ASSIGNEE_LABELS[key]}</option>
                  ))}
                </select>
                <select
                  value={step.approvalMode || 'any'}
                  onChange={(e) => updateStep(selectedStep, { approvalMode: e.target.value as ApprovalMode })}
                  className="col-span-2 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                  disabled={step.type !== 'approval'}
                >
                  <option value="any">Any of</option>
                  <option value="all">All of</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, flowSteps: prev.flowSteps.filter((_, i) => i !== selectedStep) }));
                    setSelectedStep(0);
                  }}
                  className="col-span-1 text-xs text-rose-400"
                >
                  ×
                </button>
                {step.assigneeType === 'org_role' && (
                  <input
                    value={step.orgRole || ''}
                    onChange={(e) => updateStep(selectedStep, { orgRole: e.target.value })}
                    className="col-span-6 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                    placeholder="Org role (e.g. Finance Approver)"
                  />
                )}
                {step.assigneeType === 'role' && (
                  <input
                    value={step.role || ''}
                    onChange={(e) => updateStep(selectedStep, { role: e.target.value })}
                    className="col-span-6 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                    placeholder="ACL role (e.g. admin)"
                  />
                )}
                {step.assigneeType === 'user' && (
                  <input
                    value={step.assigneeId || ''}
                    onChange={(e) => updateStep(selectedStep, { assigneeId: e.target.value })}
                    className="col-span-6 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                    placeholder="User id (e.g. u_abc)"
                  />
                )}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-brandTeal-400 uppercase tracking-wide">Form fields</h3>
              <button
                type="button"
                onClick={() => setDraft((prev) => ({
                  ...prev,
                  fields: [...prev.fields, { id: `field_${prev.fields.length + 1}`, label: 'New field', type: 'text', required: false }],
                }))}
                className="text-xs text-brandTeal-400"
              >
                + Field
              </button>
            </div>
            <div className="space-y-2">
              {draft.fields.map((field, index) => (
                <div key={`${field.id}-${index}`} className="grid grid-cols-12 gap-2 items-start p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50">
                  <input
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    className="col-span-4 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                    placeholder="Label"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateField(index, { type: e.target.value as FieldType })}
                    className="col-span-3 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Select</option>
                    <option value="date">Date</option>
                    <option value="file">File note</option>
                  </select>
                  <label className="col-span-2 flex items-center gap-1 text-[11px] text-slate-400 pt-2">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }))}
                    className="col-span-3 text-xs text-rose-400 text-right pt-2"
                  >
                    Remove
                  </button>
                  {field.type === 'select' && (
                    <input
                      value={(field.options || []).join(', ')}
                      onChange={(e) => updateField(index, {
                        options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })}
                      className="col-span-12 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                      placeholder="Options (comma-separated)"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {error && <p className="text-sm text-rose-400 px-5">{error}</p>}

        <div className="flex justify-end gap-2 p-5 border-t border-brandNavy-700">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-brandNavy-700 rounded text-slate-400">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="px-4 py-2 text-sm rounded bg-brandTeal-500 text-brandNavy-955 font-bold disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save master blueprint'}
          </button>
        </div>
      </div>
    </div>
  );
}
