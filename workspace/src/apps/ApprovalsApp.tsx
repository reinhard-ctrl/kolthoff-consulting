import { useMemo, useState } from 'react';
import { updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, logAudit, setDoc, storage, tenantCol, tenantDoc, getWorkspaceTenantId } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import {
  type ApprovalAttachment,
  type ApprovalRequest,
  type ApprovalTemplate,
  type TenantUserRow,
  buildCommentUpdate,
  buildDecisionUpdate,
  buildDelegateUpdate,
  buildInitialRequest,
  buildWithdrawUpdate,
  canActOnRequest,
  canWithdrawRequest,
  enabledTemplates,
  isOverdue,
  statusBadgeClass,
} from '../lib/approval-workflow';

type InboxTab = 'to_approve' | 'submitted' | 'watching' | 'completed';

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ApprovalTemplate['fields'][0];
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'textarea') {
    return (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className="ws-input mt-1" rows={3} required={field.required} />
    );
  }
  if (field.type === 'select') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className="ws-input mt-1" required={field.required}>
        <option value="">Select…</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'file') {
    return <p className="text-xs text-slate-500 mt-1">Attach files below after filling other fields.</p>;
  }
  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="ws-input mt-1"
      required={field.required}
    />
  );
}

export default function ApprovalsApp({ currentUserId }: { currentUserId: string }) {
  const { data: templatesRaw } = useFirestoreCollection<ApprovalTemplate>(tenantCol('core_templates'));
  const { data: requests } = useFirestoreCollection<ApprovalRequest>(tenantCol('core_requests'));
  const { data: notifications } = useFirestoreCollection<{
    id: string;
    userId: string;
    requestId?: string;
    read?: boolean;
  }>(tenantCol('core_notifications'));
  const { data: usersRaw } = useFirestoreCollection<TenantUserRow>(tenantCol('core_users'));
  const users = useMemo(() => usersRaw as TenantUserRow[], [usersRaw]);
  const templates = useMemo(() => enabledTemplates(templatesRaw), [templatesRaw]);

  const [tab, setTab] = useState<InboxTab>('to_approve');
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<ApprovalTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [delegateTo, setDelegateTo] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const firebaseUid = auth.currentUser?.uid;
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name || u.email || u.id));
    return map;
  }, [users]);

  const toApprove = requests.filter(
    (r) => r.status === 'pending' && canActOnRequest(r, currentUserId, firebaseUid),
  );
  const submitted = requests.filter((r) => r.requesterId === currentUserId);
  const watching = requests.filter(
    (r) => r.watcherIds?.includes(currentUserId) && r.requesterId !== currentUserId,
  );
  const completed = requests.filter(
    (r) =>
      r.status !== 'pending' &&
      (r.requesterId === currentUserId ||
        r.watcherIds?.includes(currentUserId) ||
        (r.stepHistory || []).some((h) => h.actorId === currentUserId)),
  );

  const listForTab =
    tab === 'to_approve' ? toApprove
      : tab === 'submitted' ? submitted
        : tab === 'watching' ? watching
          : completed;

  const detailRequest = requests.find((r) => r.id === detailId) || null;
  const detailTemplate = detailRequest
    ? templatesRaw.find((t) => t.id === detailRequest.templateId) || null
    : null;

  const markNotificationsRead = async (requestId: string) => {
    const unread = notifications.filter(
      (n) => n.userId === currentUserId && n.requestId === requestId && !n.read,
    );
    await Promise.all(
      unread.map((n) => updateDoc(tenantDoc('core_notifications', n.id), { read: true })),
    );
  };

  const openDetail = (id: string) => {
    setDetailId(id);
    setDecisionComment('');
    setDelegateTo('');
    setError('');
    setView('detail');
    void markNotificationsRead(id);
  };

  const uploadAttachments = async (requestId: string, files: File[]): Promise<ApprovalAttachment[]> => {
    const tenantId = getWorkspaceTenantId();
    if (!tenantId || !files.length) return [];
    const out: ApprovalAttachment[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `artifacts/${tenantId}/files/approvals/${requestId}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      out.push({
        name: file.name,
        url,
        uploadedAt: Date.now(),
        uploadedBy: currentUserId,
      });
    }
    return out;
  };

  const submit = async () => {
    if (!selectedTemplate) return;
    setBusy(true);
    setError('');
    try {
      const id = `req_${Date.now()}`;
      const attachments = await uploadAttachments(id, pendingFiles);
      const payload = buildInitialRequest(id, selectedTemplate, currentUserId, formData, users, {
        attachments,
        dueAt: dueAt ? new Date(dueAt).getTime() : null,
        requesterFirebaseUid: firebaseUid,
      });
      await setDoc(tenantDoc('core_requests', id), payload);
      await logAudit('approval_submit', { requestId: id, template: selectedTemplate.name });
      setView('list');
      setTab('submitted');
      setSelectedTemplate(null);
      setFormData({});
      setPendingFiles([]);
      setDueAt('');
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
      const { _notifyTargets, ...docPatch } = patch;
      await setDoc(tenantDoc('core_requests', detailRequest.id), docPatch, { merge: true });
      if (_notifyTargets?.length) {
        for (const target of _notifyTargets) {
          for (const userId of target.ids) {
            const notifId = `n_${detailRequest.id}_notify_${target.step.id}_${userId}`;
            await setDoc(tenantDoc('core_notifications', notifId), {
              id: notifId,
              userId,
              type: 'approval_notify',
              title: 'Approval update',
              body: target.step.label,
              requestId: detailRequest.id,
              read: false,
              createdAt: Date.now(),
            }, { merge: true });
          }
        }
      }
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

  const withdraw = async () => {
    if (!detailRequest || !canWithdrawRequest(detailRequest, currentUserId)) return;
    setBusy(true);
    setError('');
    try {
      const patch = buildWithdrawUpdate(detailRequest, currentUserId, decisionComment);
      await setDoc(tenantDoc('core_requests', detailRequest.id), patch, { merge: true });
      await logAudit('approval_withdraw', { requestId: detailRequest.id });
      setView('list');
      setDetailId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdraw failed');
    } finally {
      setBusy(false);
    }
  };

  const addComment = async () => {
    if (!detailRequest || !decisionComment.trim()) return;
    setBusy(true);
    setError('');
    try {
      const patch = buildCommentUpdate(detailRequest, currentUserId, decisionComment);
      await setDoc(tenantDoc('core_requests', detailRequest.id), patch, { merge: true });
      await logAudit('approval_comment', { requestId: detailRequest.id });
      setDecisionComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comment failed');
    } finally {
      setBusy(false);
    }
  };

  const delegate = async () => {
    if (!detailRequest || !delegateTo) return;
    if (!canActOnRequest(detailRequest, currentUserId, firebaseUid)) {
      setError('Only current assignees can delegate.');
      return;
    }
    const toUser = users.find((u) => u.id === delegateTo);
    if (!toUser) return;
    setBusy(true);
    setError('');
    try {
      const patch = buildDelegateUpdate(detailRequest, currentUserId, toUser, decisionComment);
      await setDoc(tenantDoc('core_requests', detailRequest.id), patch, { merge: true });
      await logAudit('approval_delegate', { requestId: detailRequest.id, toUserId: toUser.id });
      setView('list');
      setDetailId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delegate failed');
    } finally {
      setBusy(false);
    }
  };

  if (view === 'new' && selectedTemplate) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="ws-page max-w-xl">
          <button type="button" onClick={() => setView('list')} className="text-sm text-brandTeal-600 mb-4">← Back</button>
          <h1 className="ws-title">{selectedTemplate.name}</h1>
          {selectedTemplate.description && <p className="ws-subtitle mb-4">{selectedTemplate.description}</p>}
          <div className="ws-panel p-5 mt-4 space-y-3">
            {selectedTemplate.fields.filter((f) => f.type !== 'file').map((f) => (
              <div key={f.id}>
                <label className="text-sm font-medium text-slate-700">{f.label}</label>
                <FieldInput
                  field={f}
                  value={formData[f.id] || ''}
                  onChange={(value) => setFormData({ ...formData, [f.id]: value })}
                />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-slate-700">Due date (optional)</label>
              <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="ws-input mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Attachments</label>
              <input
                type="file"
                multiple
                className="ws-input mt-1"
                onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
              />
              {pendingFiles.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">{pendingFiles.length} file(s) selected</p>
              )}
            </div>
            <div className="text-xs text-slate-500 border-t pt-3">
              Flow: {selectedTemplate.flowSteps.map((s) => s.label).join(' → ')}
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="button" onClick={submit} disabled={busy} className="ws-btn-primary disabled:opacity-50">
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && detailRequest && detailTemplate) {
    const canAct = canActOnRequest(detailRequest, currentUserId, firebaseUid);
    const canWithdraw = canWithdrawRequest(detailRequest, currentUserId);
    const overdue = isOverdue(detailRequest);

    return (
      <div className="h-full overflow-y-auto">
        <div className="ws-page max-w-3xl">
          <button type="button" onClick={() => setView('list')} className="text-sm text-brandTeal-600 mb-4">← Back</button>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="ws-title">{detailTemplate.name}</h1>
            <span className={`ws-chip ${statusBadgeClass(detailRequest.status)}`}>{detailRequest.status}</span>
            {overdue && <span className="ws-chip bg-rose-100 text-rose-800">Overdue</span>}
          </div>
          {detailRequest.currentStepLabel && detailRequest.status === 'pending' && (
            <p className="ws-subtitle">
              Current step: {detailRequest.currentStepLabel}
              {detailRequest.currentApprovalMode === 'all' ? ' (all assignees)' : ''}
            </p>
          )}

          <div className="ws-panel p-5 mt-4 mb-4 space-y-2 text-sm">
            <div className="text-xs text-slate-500">
              From {userNameById.get(detailRequest.requesterId) || detailRequest.requesterId}
              {detailRequest.dueAt ? ` · Due ${new Date(detailRequest.dueAt).toLocaleDateString()}` : ''}
            </div>
            {detailTemplate.fields.map((f) => (
              <div key={f.id}>
                <div className="text-xs text-slate-500">{f.label}</div>
                <div className="text-slate-800">{String(detailRequest.formData[f.id] ?? '—')}</div>
              </div>
            ))}
            {(detailRequest.attachments || []).length > 0 && (
              <div className="pt-2 border-t">
                <div className="text-xs text-slate-500 mb-1">Attachments</div>
                {detailRequest.attachments!.map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-brandTeal-600 underline">
                    {a.name}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">Timeline</h3>
            <div className="space-y-2">
              {(detailRequest.stepHistory || []).map((h, i) => (
                <div key={`${h.at}-${i}`} className="text-xs ws-panel p-3">
                  <span className="font-semibold text-slate-800">{h.stepLabel}</span>
                  {' · '}
                  {userNameById.get(h.actorId) || h.actorId}
                  {' · '}
                  <span className="capitalize">{h.action}</span>
                  {h.comment ? ` — “${h.comment}”` : ''}
                  <div className="text-slate-400 mt-0.5">{new Date(h.at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ws-panel p-5 border-t-0">
            <label className="text-sm font-medium block mb-1">Comment</label>
            <textarea
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
              className="ws-input mb-3"
              rows={2}
              placeholder="Optional note"
            />
            {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}
            <div className="flex flex-wrap gap-2">
              {canAct && (
                <>
                  <button type="button" onClick={() => applyDecision('approve')} disabled={busy} className="ws-btn-primary disabled:opacity-50">
                    Approve
                  </button>
                  <button type="button" onClick={() => applyDecision('reject')} disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    Reject
                  </button>
                  <select
                    value={delegateTo}
                    onChange={(e) => setDelegateTo(e.target.value)}
                    className="ws-input max-w-[12rem]"
                  >
                    <option value="">Delegate to…</option>
                    {users.filter((u) => u.id !== currentUserId).map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>
                    ))}
                  </select>
                  <button type="button" onClick={delegate} disabled={busy || !delegateTo} className="ws-btn-secondary disabled:opacity-50">
                    Delegate
                  </button>
                </>
              )}
              <button type="button" onClick={addComment} disabled={busy || !decisionComment.trim()} className="ws-btn-secondary disabled:opacity-50">
                Comment only
              </button>
              {canWithdraw && (
                <button type="button" onClick={withdraw} disabled={busy} className="ws-btn-secondary disabled:opacity-50">
                  Withdraw
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: InboxTab; label: string; count: number }[] = [
    { id: 'to_approve', label: 'To approve', count: toApprove.length },
    { id: 'submitted', label: 'Submitted', count: submitted.length },
    { id: 'watching', label: 'Watching', count: watching.length },
    { id: 'completed', label: 'Completed', count: completed.length },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="ws-page">
        <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
          <div>
            <h1 className="ws-title">Approval Center</h1>
            <p className="ws-subtitle">Review, submit, and track workplace requests.</p>
          </div>
          <select
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              if (t) {
                setSelectedTemplate(t);
                setFormData({});
                setPendingFiles([]);
                setDueAt('');
                setView('new');
              }
              e.target.value = '';
            }}
            className="ws-input max-w-xs"
            defaultValue=""
          >
            <option value="" disabled>+ New request</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`ws-tab ${tab === t.id ? 'ws-tab-active' : ''}`}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1.5 opacity-70">{t.count}</span>}
            </button>
          ))}
        </div>

        {templates.length === 0 && (
          <p className="text-sm text-slate-500 mb-4">No approval templates yet. Ask your administrator to deploy blueprints.</p>
        )}

        <div className="space-y-2">
          {listForTab.map((r) => {
            const name = templatesRaw.find((t) => t.id === r.templateId)?.name || r.templateId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => openDetail(r.id)}
                className="ws-panel w-full text-left p-4 hover:border-brandTeal-400 transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`ws-chip ${statusBadgeClass(r.status)}`}>{r.status}</span>
                  {isOverdue(r) && <span className="ws-chip bg-rose-100 text-rose-800">Overdue</span>}
                  <span className="font-medium text-sm text-slate-900">{name}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  From {userNameById.get(r.requesterId) || r.requesterId}
                  {r.currentStepLabel && r.status === 'pending' ? ` · ${r.currentStepLabel}` : ''}
                  {r.updatedAt ? ` · ${new Date(r.updatedAt).toLocaleString()}` : ''}
                </div>
              </button>
            );
          })}
          {listForTab.length === 0 && (
            <p className="text-sm text-slate-400 italic py-8 text-center">Nothing in this inbox.</p>
          )}
        </div>
      </div>
    </div>
  );
}
