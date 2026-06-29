import { useState } from 'react';
import { addDoc, setDoc, tenantCol, tenantDoc, logAudit } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

interface Template {
  id: string;
  name: string;
  fields: { id: string; label: string; type: string; required?: boolean }[];
  flowSteps: { id: string; type: string; label: string }[];
}

interface Request {
  id: string;
  templateId: string;
  requesterId: string;
  status: string;
  formData: Record<string, unknown>;
  currentStepIndex: number;
}

export default function ApprovalsApp({ currentUserId }: { currentUserId: string }) {
  const { data: templates } = useFirestoreCollection<Template>(tenantCol('core_templates'));
  const { data: requests } = useFirestoreCollection<Request>(tenantCol('core_requests'));
  const [view, setView] = useState<'list' | 'new'>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const myRequests = requests.filter((r) => r.requesterId === currentUserId);
  const pending = requests.filter((r) => r.status === 'pending');

  const submit = async () => {
    if (!selectedTemplate) return;
    const id = `req_${Date.now()}`;
    await setDoc(tenantDoc('core_requests', id), {
      id, templateId: selectedTemplate.id, requesterId: currentUserId,
      status: 'pending', formData, currentStepIndex: 0, createdAt: Date.now(),
    });
    await logAudit('approval_submit', { requestId: id, template: selectedTemplate.name });
    setView('list');
    setSelectedTemplate(null);
    setFormData({});
  };

  if (view === 'new' && selectedTemplate) {
    return (
      <div className="p-6 max-w-lg">
        <button onClick={() => setView('list')} className="text-sm text-blue-600 mb-4">← Back</button>
        <h2 className="text-xl font-bold mb-4">{selectedTemplate.name}</h2>
        {selectedTemplate.fields.map((f) => (
          <div key={f.id} className="mb-3">
            <label className="text-sm font-medium">{f.label}</label>
            <input type={f.type === 'number' ? 'number' : 'text'} value={formData[f.id] || ''}
              onChange={(e) => setFormData({ ...formData, [f.id]: e.target.value })}
              className="w-full p-2 border rounded-lg mt-1" required={f.required} />
          </div>
        ))}
        <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Submit Request</button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Approvals</h2>
        <select onChange={(e) => {
          const t = templates.find((x) => x.id === e.target.value);
          if (t) { setSelectedTemplate(t); setView('new'); }
        }} className="p-2 border rounded-lg text-sm" defaultValue="">
          <option value="" disabled>+ New Request</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-500 mb-2">My Requests ({myRequests.length})</h3>
          {myRequests.map((r) => (
            <div key={r.id} className="p-3 bg-white rounded-lg border mb-2 text-sm">
              <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
              <span className="ml-2">{templates.find((t) => t.id === r.templateId)?.name || r.templateId}</span>
            </div>
          ))}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-500 mb-2">Pending Queue ({pending.length})</h3>
          {pending.map((r) => (
            <div key={r.id} className="p-3 bg-white rounded-lg border mb-2 text-sm flex justify-between">
              <span>{templates.find((t) => t.id === r.templateId)?.name}</span>
              <div className="flex gap-1">
                <button onClick={() => setDoc(tenantDoc('core_requests', r.id), { status: 'approved' }, { merge: true })}
                  className="px-2 py-1 bg-green-600 text-white rounded text-xs">Approve</button>
                <button onClick={() => setDoc(tenantDoc('core_requests', r.id), { status: 'rejected' }, { merge: true })}
                  className="px-2 py-1 bg-red-600 text-white rounded text-xs">Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
