import { useEffect, useState } from 'react';
import { onSnapshot, setDoc, doc, collection } from 'firebase/firestore';
import { db, bootstrapAuth, functions, httpsCallable } from '../lib/firebase';

interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function Tenants() {
  const [tenantId, setTenantId] = useState('kolthoff-admin-app');
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [features, setFeatures] = useState({ messenger: true, approvals: true, vault: false, crm: false });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const configRef = doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config');
    const usersRef = collection(db, 'artifacts', tenantId, 'public', 'data', 'core_users');

    const u1 = onSnapshot(configRef, (snap) => {
      if (snap.exists() && snap.data().features) setFeatures(snap.data().features);
    });
    const u2 = onSnapshot(usersRef, (snap) => {
      const list: TenantUser[] = [];
      snap.forEach((d) => list.push(d.data() as TenantUser));
      setUsers(list);
    });
    return () => { u1(); u2(); };
  }, [tenantId]);

  const toggleFeature = async (key: keyof typeof features) => {
    const updated = { ...features, [key]: !features[key] };
    setFeatures(updated);
    await setDoc(doc(db, 'artifacts', tenantId, 'public', 'data', 'tenant_settings', 'config'), { features: updated }, { merge: true });
  };

  const provisionUser = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteStatus('');
    try {
      await bootstrapAuth();
      const invite = httpsCallable(functions, 'inviteWorkspaceUser');
      await invite({
        email: inviteEmail.trim(),
        name: inviteName || inviteEmail.trim(),
        tenantId,
        role: 'user',
      });
      setInviteStatus(`Invited ${inviteEmail}. Enable Email/Password auth in Firebase if not already on.`);
      setInviteEmail('');
      setInviteName('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invite failed';
      setInviteStatus(msg.includes('permission-denied')
        ? 'Admin session required. Re-login at /admin/ and try again.'
        : msg);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tenant Manager</h1>
      <div className="glass-panel p-4 mb-6">
        <label className="text-sm text-slate-400">Tenant App ID</label>
        <input value={tenantId} onChange={(e) => setTenantId(e.target.value)}
          className="w-full mt-1 p-2 rounded bg-brandNavy-800 border border-brandNavy-700 font-mono text-sm" />
        <a href={`/workspace/?tenant=${tenantId}`} className="text-brandTeal-400 text-sm mt-2 inline-block">Open workspace →</a>
      </div>

      <div className="glass-panel p-4 mb-6">
        <h2 className="font-bold mb-3">Feature Flags</h2>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(features) as (keyof typeof features)[]).map((key) => (
            <button key={key} onClick={() => toggleFeature(key)}
              className={`px-3 py-1 rounded text-sm capitalize ${features[key] ? 'bg-brandTeal-500/20 text-brandTeal-400 border border-brandTeal-500/50' : 'bg-brandNavy-800 text-slate-500'}`}>
              {key}: {features[key] ? 'ON' : 'OFF'}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel p-4 mb-6">
        <h2 className="font-bold mb-3">Invite Workspace User</h2>
        <p className="text-xs text-slate-500 mb-3">Creates Firebase Auth user + core_users doc. Requires Email/Password sign-in enabled.</p>
        <div className="flex gap-2 flex-wrap">
          <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Name" className="p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm" />
          <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" className="p-2 rounded bg-brandNavy-800 border border-brandNavy-700 text-sm" />
          <button onClick={provisionUser} disabled={inviting} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm disabled:opacity-50">
            {inviting ? 'Inviting...' : 'Invite User'}
          </button>
        </div>
        {inviteStatus && <p className="text-xs mt-2 text-slate-400">{inviteStatus}</p>}
      </div>

      <div className="glass-panel p-4">
        <h2 className="font-bold mb-3">Users ({users.length})</h2>
        {users.map((u) => (
          <div key={u.id} className="flex justify-between py-2 border-b border-brandNavy-800 text-sm">
            <span>{u.name} <span className="text-slate-500">({u.email})</span></span>
            <span className="text-brandTeal-400 uppercase text-xs">{u.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
