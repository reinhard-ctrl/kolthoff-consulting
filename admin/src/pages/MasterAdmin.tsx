import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { db, adminAppId } from '../lib/firebase';

interface MasterTemplate {
  id: string;
  name?: string;
  type?: string;
  fields?: unknown[];
}

interface ItTicket {
  id: string;
  tenantId?: string;
  subject?: string;
  description?: string;
  status?: string;
  timestamp?: number;
  requesterName?: string;
}

export default function MasterAdmin() {
  const [mode, setMode] = useState<'tickets' | 'blueprints'>('tickets');
  const [tenantId, setTenantId] = useState('kolthoff-admin-app');
  const [connectedTenant, setConnectedTenant] = useState('');
  const [templates, setTemplates] = useState<MasterTemplate[]>([]);
  const [tickets, setTickets] = useState<ItTicket[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      collection(db, 'artifacts', adminAppId, 'public', 'data', 'master_templates'),
      (snap) => {
        const list: MasterTemplate[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as MasterTemplate));
        setTemplates(list);
      }
    );
  }, []);

  useEffect(() => {
    if (!connectedTenant) {
      setTickets([]);
      return;
    }
    return onSnapshot(
      collection(db, 'artifacts', connectedTenant, 'public', 'data', 'core_it_requests'),
      (snap) => {
        const list: ItTicket[] = [];
        snap.forEach((d) => list.push({ id: d.id, tenantId: connectedTenant, ...d.data() } as ItTicket));
        setTickets(list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      }
    );
  }, [connectedTenant]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const connectTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (tenantId.trim()) {
      setConnectedTenant(tenantId.trim());
      showToast(`Connected to ${tenantId.trim()}`);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    if (!connectedTenant) return;
    await setDoc(
      doc(db, 'artifacts', connectedTenant, 'public', 'data', 'core_it_requests', ticketId),
      { status },
      { merge: true }
    );
    showToast('Ticket updated.');
  };

  const deleteTemplate = async (id: string) => {
    await deleteDoc(doc(db, 'artifacts', adminAppId, 'public', 'data', 'master_templates', id));
    showToast('Blueprint deleted.');
  };

  const nukeTenantData = async () => {
    if (!connectedTenant || !confirm(`Delete ALL data for tenant ${connectedTenant}?`)) return;
    const cols = ['core_users', 'core_departments', 'core_requests', 'core_templates', 'core_policies', 'core_it_requests'];
    for (const col of cols) {
      const snap = await getDocs(collection(db, 'artifacts', connectedTenant, 'public', 'data', col));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    }
    showToast('Tenant data cleared.');
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-brandTeal-600 text-white px-4 py-3 rounded-lg shadow-2xl font-bold text-xs">
          {toast}
        </div>
      )}

      <h1 className="text-2xl font-bold mb-2">Master Admin</h1>
      <p className="text-sm text-slate-400 mb-6">
        IT tickets and master blueprints. For tenant users and feature flags, use{' '}
        <a href="/admin/tenants" className="text-brandTeal-400 underline">Tenant Manager</a>.
      </p>

      <form onSubmit={connectTenant} className="glass-panel p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Workspace App ID</label>
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="bg-brandNavy-800 border border-brandNavy-700 rounded p-2 text-sm font-mono min-w-[240px]"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm">
          Connect
        </button>
        {connectedTenant && (
          <button type="button" onClick={nukeTenantData} className="px-4 py-2 text-rose-400 border border-rose-500/30 rounded text-sm">
            Nuke Tenant Data
          </button>
        )}
      </form>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('tickets')}
          className={`px-3 py-1.5 rounded text-sm ${mode === 'tickets' ? 'bg-brandTeal-500 text-brandNavy-955 font-bold' : 'bg-brandNavy-800 text-slate-400'}`}
        >
          IT Tickets {connectedTenant && `(${tickets.filter((t) => t.status === 'open').length} open)`}
        </button>
        <button
          onClick={() => setMode('blueprints')}
          className={`px-3 py-1.5 rounded text-sm ${mode === 'blueprints' ? 'bg-brandTeal-500 text-brandNavy-955 font-bold' : 'bg-brandNavy-800 text-slate-400'}`}
        >
          Master Blueprints ({templates.length})
        </button>
      </div>

      {mode === 'tickets' && (
        <div className="glass-panel overflow-hidden">
          {!connectedTenant ? (
            <p className="p-6 text-slate-500 italic">Connect to a tenant App ID to view IT tickets.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-brandNavy-950 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Requester</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brandNavy-800">
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="p-4">
                      <div className="font-bold">{t.subject || 'Support Request'}</div>
                      <div className="text-xs text-slate-500 truncate max-w-md">{t.description}</div>
                    </td>
                    <td className="p-4 text-xs">{t.requesterName || '—'}</td>
                    <td className="p-4 text-xs uppercase">{t.status || 'open'}</td>
                    <td className="p-4 text-right space-x-2">
                      {t.status !== 'closed' && (
                        <>
                          <button onClick={() => updateTicketStatus(t.id, 'in_progress')} className="text-xs text-brandTeal-400">In Progress</button>
                          <button onClick={() => updateTicketStatus(t.id, 'closed')} className="text-xs text-emerald-400">Close</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {connectedTenant && tickets.length === 0 && (
            <p className="p-6 text-slate-500 italic">No IT tickets for this tenant.</p>
          )}
        </div>
      )}

      {mode === 'blueprints' && (
        <div className="space-y-3">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="glass-panel p-4 flex justify-between items-center">
              <div>
                <div className="font-bold">{tmpl.name || tmpl.id}</div>
                <div className="text-xs text-slate-500">{tmpl.type || 'template'} · {tmpl.fields?.length || 0} fields</div>
              </div>
              <button onClick={() => deleteTemplate(tmpl.id)} className="text-red-400 text-xs">Delete</button>
            </div>
          ))}
          {templates.length === 0 && <p className="text-slate-500 italic">No master blueprints yet.</p>}
        </div>
      )}
    </div>
  );
}
