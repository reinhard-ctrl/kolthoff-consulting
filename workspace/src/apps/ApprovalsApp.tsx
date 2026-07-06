import { useMemo, useState } from 'react';
import { auth, logAudit, setDoc, tenantCol, tenantDoc } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import {
  type ApprovalRequest,
  type ApprovalTemplate,
  type TenantUserRow,
  buildDecisionUpdate,
  buildInitialRequest,
  canActOnRequest,
  statusBadgeClass,
} from '../lib/approval-workflow';

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ApprovalTemplate['fields'][0];
  value: string;
  onChange: (value: string) => void;
}) {
  const common = 'w-full p-2 border rounded-lg mt-1 text-sm';
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={common}
        rows={3}
        required={field.required}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={common} required={field.required}>
        <option value="">Select…</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={common}
      required={field.required}
    />
  );
}

export default function ApprovalsApp({ currentUserId }: { currentUserId: string }) {
  const { data: templates } = useFirestoreCollection<ApprovalTemplate>(tenantCol('core_templates'));
  const { data: requests } = useFirestoreCollection<ApprovalRequest>(tenantCol('core_requests'));
  const { data: usersRaw } = useFirestoreCollection<TenantUserRow>(tenantCol('core_users'));
  const users = useMemo(() => usersRaw as TenantUserRow[], [usersRaw]);

  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<ApprovalTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const firebaseUid = auth.currentUser?.uid;
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name || u.email || u.id));
    return map;
  }, [users]);

  const myRequests = requests.filter((r) => r.requesterId === currentUserId);
  const pendingMine = requests.filter(
    (r) => r.status === 'pending' && canActOnRequest(r, currentUserId, firebaseUid),
  );
  const detailRequest = requests.find((r) => r.id === detailId) || null;
  const detailTemplate = detailRequest
    ? templates.find((t) => t.id === detailRequest.templateId)
    : null;

  const openDetail = (id: string) => {
    setDetailId(id);
    setDecisionComment('');
    setError('');
    setView('detail');
  };

  const submit = async () => {
    if (!selectedTemplate) return;
    setBusy(true);
    setError('');
    try {
      const id = `req_${Date.now()}`;
      const payload = buildInitialRequest(id, selectedTemplate, currentUserId, formData, users);
      await setDoc(tenantDoc('core_requests', id), payload);
      await logAudit('approval_submit', { requestId: id, template: selectedTemplate.name });
      setView('list');
      setSelectedTemplate(null);
      setFormData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const applyDecision = async (decision: 'approve' | 'reject') => {
    if (!detailRequest || !detailTemplate) return;
    if (!canActOnRequest(detailRequest, currentUserId, firebaseUid)) {
      setError('You are not assigned to approve this request.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const patch = buildDecisionUpdate(
        detailRequest,
        detailTemplate,
        users,
        currentUserId,
        decision,
        decisionComment,
      );
      await setDoc(tenantDoc('core_requests', detailRequest.id), patch, { merge: true });
      await logAudit(`approval_${decision}`, {
        requestId: detailRequest.id,
        template: detailTemplate.name,
        comment: decisionComment.trim() || null,
      });
      setView('list');
      setDetailId(null);
      setDecisionComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (view === 'new' && selectedTemplate) {
    return (
      <div className="p-6 max-w-lg overflow-y-auto h-full">
        <button type="button" onClick={() => setView('list')} className="text-sm text-blue-600 mb-4">← Back</button>
        <h2 className="text-xl font-bold mb-1">{selectedTemplate.name}</h2>
        {selectedTemplate.flowSteps[0] && (
          <p className="text-xs text-slate-500 mb-4">First step: {selectedTemplate.flowSteps[0].label}</p>
        )}
        {selectedTemplate.fields.map((f) => (
          <div key={f.id} className="mb-3">
            <label className="text-sm font-medium">{f.label}</label>
            <FieldInput
              field={f}
              value={formData[f.id] || ''}
              onChange={(value) => setFormData({ ...formData, [f.id]: value })}
            />
          </div>
        ))}
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>
    );
  }

  if (view === 'detail' && detailRequest && detailTemplate) {
    const canAct = canActOnRequest(detailRequest, currentUserId, firebaseUid);
    return (
      <div className="p-6 max-w-2xl overflow-y-auto h-full">
        <button type="button" onClick={() => setView('list')} className="text-sm text-blue-600 mb-4">← Back</button>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-xl font-bold">{detailTemplate.name}</h2>
          <span className={`px-2 py-0.5 rounded text-xs ${statusBadgeClass(detailRequest.status)}`}>
            {detailRequest.status}
          </span>
        </div>
        {detailRequest.currentStepLabel && detailRequest.status === 'pending' && (
          <p className="text-sm text-slate-500 mb-4">Current step: {detailRequest.currentStepLabel}</p>
        )}

        <div className="bg-white rounded-lg border p-4 mb-4 space-y-2 text-sm">
          {detailTemplate.fields.map((f) => (
            <div key={f.id}>
              <div className="text-xs text-slate-500">{f.label}</div>
              <div>{String(detailRequest.formData[f.id] ?? '—')}</div>
            </div>
          ))}
        </div>

        {(detailRequest.stepHistory || []).length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">History</h3>
            <div className="space-y-2">
              {detailRequest.stepHistory!.map((h, i) => (
                <div key={`${h.at}-${i}`} className="text-xs bg-slate-100 rounded p-2">
                  <span className="font-medium">{h.stepLabel}</span>
                  {' · '}
                  {userNameById.get(h.actorId) || h.actorId}
                  {' · '}
                  {h.action}
                  {h.comment ? ` — "${h.comment}"` : ''}
                  <div className="text-slate-400">{new Date(h.at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canAct && (
          <div className="border-t pt-4">
            <label className="text-sm font-medium block mb-1">Comment (optional)</label>
            <textarea
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm mb-3"
              rows={2}
            />
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => applyDecision('approve')}
                disabled={busy}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => applyDecision('reject')}
                disabled={busy}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Approvals</h2>
          {pendingMine.length > 0 && (
            <p className="text-xs text-amber-600">{pendingMine.length} pending your action</p>
          )}
        </div>
        <select
          onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) {
              setSelectedTemplate(t);
              setFormData({});
              setView('new');
            }
            e.target.value = '';
          }}
          className="p-2 border rounded-lg text-sm"
          defaultValue=""
        >
          <option value="" disabled>+ New Request</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {templates.length === 0 && (
        <p className="text-sm text-slate-500 mb-4">No approval templates yet. Ask your administrator to deploy blueprints.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-500 mb-2">My Requests ({myRequests.length})</h3>
          {myRequests.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openDetail(r.id)}
              className="block w-full text-left p-3 bg-white rounded-lg border mb-2 text-sm hover:border-blue-300"
            >
              <span className={`px-2 py-0.5 rounded text-xs ${statusBadgeClass(r.status)}`}>{r.status}</span>
              <span className="ml-2">{templates.find((t) => t.id === r.templateId)?.name || r.templateId}</span>
              {r.currentStepLabel && r.status === 'pending' && (
                <span className="block text-xs text-slate-400 mt-1">{r.currentStepLabel}</span>
              )}
            </button>
          ))}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-500 mb-2">Pending My Approval ({pendingMine.length})</h3>
          {pendingMine.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openDetail(r.id)}
              className="block w-full text-left p-3 bg-white rounded-lg border mb-2 text-sm hover:border-blue-300"
            >
              <span>{templates.find((t) => t.id === r.templateId)?.name}</span>
              <span className="block text-xs text-slate-400 mt-1">
                From {userNameById.get(r.requesterId) || r.requesterId}
              </span>
            </button>
          ))}
          {pendingMine.length === 0 && (
            <p className="text-xs text-slate-400 italic">No requests waiting for you.</p>
          )}
        </div>
      </div>
    </div>
  );
}
