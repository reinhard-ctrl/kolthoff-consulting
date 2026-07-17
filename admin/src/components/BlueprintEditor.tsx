import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, adminAppId } from '../lib/firebase';

export type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'date' | 'file';
export type StepType = 'approval' | 'notify';
export type AssigneeType = 'user' | 'role' | 'any_admin';
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

const emptyDraft = (): BlueprintDraft => ({
  id: `tpl-${Date.now().toString(36)}`,
  name: '',
  type: 'approval',
  description: '',
  enabled: true,
  fields: [{ id: 'field1', label: 'Details', type: 'textarea', required: true }],
  flowSteps: [{ id: 'step1', type: 'approval', label: 'Manager approval', assigneeType: 'any_admin', approvalMode: 'any' }],
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

  return (
    <div className="fixed inset-0 z-[180] bg-black/70 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Approval blueprint editor</h2>
            <p className="text-xs text-slate-400 mt-1">
              Design master templates (fields + sequential steps). Deploy to a client tenant after saving.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm">Close</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
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
              placeholder="Shown to requesters"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={draft.enabled !== false}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            Enabled by default when deployed
          </label>
        </div>

        <section className="mb-5">
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

        <section className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-brandTeal-400 uppercase tracking-wide">Flow steps</h3>
            <button
              type="button"
              onClick={() => setDraft((prev) => ({
                ...prev,
                flowSteps: [...prev.flowSteps, {
                  id: `step_${prev.flowSteps.length + 1}`,
                  type: 'approval',
                  label: 'Approval',
                  assigneeType: 'any_admin',
                  approvalMode: 'any',
                }],
              }))}
              className="text-xs text-brandTeal-400"
            >
              + Step
            </button>
          </div>
          <div className="space-y-2">
            {draft.flowSteps.map((step, index) => (
              <div key={`${step.id}-${index}`} className="grid grid-cols-12 gap-2 p-3 rounded border border-brandNavy-700 bg-brandNavy-900/50">
                <input
                  value={step.label}
                  onChange={(e) => updateStep(index, { label: e.target.value })}
                  className="col-span-4 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                  placeholder="Step label"
                />
                <select
                  value={step.type}
                  onChange={(e) => updateStep(index, { type: e.target.value as StepType })}
                  className="col-span-2 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                >
                  <option value="approval">Approval</option>
                  <option value="notify">Notify</option>
                </select>
                <select
                  value={step.assigneeType || 'any_admin'}
                  onChange={(e) => updateStep(index, { assigneeType: e.target.value as AssigneeType })}
                  className="col-span-3 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                >
                  <option value="any_admin">Any admin</option>
                  <option value="role">By role</option>
                  <option value="user">By user id</option>
                </select>
                <select
                  value={step.approvalMode || 'any'}
                  onChange={(e) => updateStep(index, { approvalMode: e.target.value as ApprovalMode })}
                  className="col-span-2 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                  disabled={step.type !== 'approval'}
                >
                  <option value="any">Any of</option>
                  <option value="all">All of</option>
                </select>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, flowSteps: prev.flowSteps.filter((_, i) => i !== index) }))}
                  className="col-span-1 text-xs text-rose-400"
                >
                  ×
                </button>
                {step.assigneeType === 'role' && (
                  <input
                    value={step.role || ''}
                    onChange={(e) => updateStep(index, { role: e.target.value })}
                    className="col-span-6 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                    placeholder="Role (e.g. admin)"
                  />
                )}
                {step.assigneeType === 'user' && (
                  <input
                    value={step.assigneeId || ''}
                    onChange={(e) => updateStep(index, { assigneeId: e.target.value })}
                    className="col-span-6 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-xs"
                    placeholder="User id (e.g. u_abc)"
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
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
