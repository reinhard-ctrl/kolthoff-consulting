import { useMemo, useState } from 'react';
import { setDoc } from 'firebase/firestore';
import { logAudit, tenantCol, tenantDoc } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

export type TicketCategory = 'inquiry' | 'ticket' | 'customization';

interface SupportTicket {
  id: string;
  subject?: string;
  description?: string;
  status?: string;
  category?: TicketCategory;
  priority?: string;
  requesterId?: string;
  requesterName?: string;
  timestamp?: number;
  updatedAt?: number;
  staffNotes?: string;
}

const CATEGORIES: { id: TicketCategory; label: string; hint: string }[] = [
  { id: 'inquiry', label: 'Inquiry', hint: 'General question about workspace or process' },
  { id: 'ticket', label: 'IT / Access', hint: 'Login, permissions, or technical issue' },
  { id: 'customization', label: 'Customization', hint: 'New approval template, fields, or workflow change' },
];

function statusClass(status?: string) {
  if (status === 'closed' || status === 'done') return 'bg-emerald-100 text-emerald-800';
  if (status === 'in_progress' || status === 'waiting_on_client') return 'bg-sky-100 text-sky-800';
  return 'bg-amber-100 text-amber-800';
}

export default function HelpDeskApp({
  currentUserId,
  currentUserName,
}: {
  currentUserId: string;
  currentUserName: string;
}) {
  const { data: tickets } = useFirestoreCollection<SupportTicket>(tenantCol('core_it_requests'));
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('inquiry');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const mine = useMemo(
    () =>
      tickets
        .filter((t) => t.requesterId === currentUserId)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [tickets, currentUserId],
  );

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      setError('Subject and description are required.');
      return;
    }
    setBusy(true);
    setError('');
    setOk('');
    try {
      const id = `tkt_${Date.now()}`;
      const now = Date.now();
      await setDoc(tenantDoc('core_it_requests', id), {
        id,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        status: 'open',
        requesterId: currentUserId,
        requesterName: currentUserName,
        timestamp: now,
        updatedAt: now,
      });
      await logAudit('helpdesk_submit', { ticketId: id, category });
      setSubject('');
      setDescription('');
      setCategory('inquiry');
      setPriority('normal');
      setOk('Request submitted. Your administrator will follow up shortly.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="ws-page">
        <header className="mb-6">
          <h1 className="ws-title">Help &amp; requests</h1>
          <p className="ws-subtitle">Submit inquiries, IT tickets, or customization requests to your administrator.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="ws-panel p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">New request</h2>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`rounded-lg border px-2 py-2 text-left text-xs transition ${
                    category === c.id
                      ? 'border-brandTeal-500 bg-brandTeal-500/10 text-slate-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold">{c.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{c.hint}</div>
                </button>
              ))}
            </div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="ws-input mb-3"
              placeholder="Short summary"
            />
            <label className="block text-xs font-medium text-slate-500 mb-1">Details</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="ws-input mb-3"
              rows={5}
              placeholder="What do you need?"
            />
            <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'normal' | 'high')}
              className="ws-input mb-4"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}
            {ok && <p className="text-sm text-emerald-700 mb-2">{ok}</p>}
            <button type="button" onClick={submit} disabled={busy} className="ws-btn-primary disabled:opacity-50">
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
          </section>

          <section className="ws-panel p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">My requests ({mine.length})</h2>
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {mine.map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm text-slate-800">{t.subject}</div>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] uppercase ${statusClass(t.status)}`}>
                      {(t.status || 'open').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 capitalize">
                    {t.category || 'ticket'} · {t.priority || 'normal'}
                    {t.timestamp ? ` · ${new Date(t.timestamp).toLocaleString()}` : ''}
                  </div>
                  <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">{t.description}</p>
                  {t.staffNotes && (
                    <p className="text-xs text-brandTeal-700 mt-2 bg-brandTeal-500/10 rounded p-2">
                      Staff note: {t.staffNotes}
                    </p>
                  )}
                </div>
              ))}
              {mine.length === 0 && (
                <p className="text-sm text-slate-400 italic">No requests yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
