import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { adminCol } from '../lib/firebase';

export default function Dashboard() {
  const [stats, setStats] = useState({ clients: 0, profiles: 0, contracts: 0, intake: 0, tickets: 0 });

  useEffect(() => {
    const cols: (keyof typeof stats)[] = ['clients', 'workbook_profiles', 'contracts_ledger', 'intake_forms', 'core_it_requests'];
    const unsubs = cols.map((col) =>
      onSnapshot(adminCol(col), (snap) => setStats((s) => ({ ...s, [col === 'workbook_profiles' ? 'profiles' : col === 'contracts_ledger' ? 'contracts' : col === 'intake_forms' ? 'intake' : col === 'core_it_requests' ? 'tickets' : col]: snap.size })))
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const cards = [
    { label: 'Client Portals', value: stats.clients, href: '/admin/legacy/admin_console.html' },
    { label: 'SOW Profiles', value: stats.profiles, href: '/apps/delivery/project_planner.html' },
    { label: 'Contracts', value: stats.contracts, href: '/admin/legacy/contract_ledger.html' },
    { label: 'Intake Forms', value: stats.intake, href: '/admin/intake' },
    { label: 'IT Tickets', value: stats.tickets, href: '/admin/legacy/core_master_admin.html' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Operations Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <a key={c.label} href={c.href} className="glass-panel p-5 hover:border-brandTeal-500/50 transition-colors">
            <div className="text-xs text-slate-500 uppercase">{c.label}</div>
            <div className="text-3xl font-bold text-brandTeal-400 mt-1">{c.value}</div>
          </a>
        ))}
      </div>
      <div className="glass-panel p-6">
        <h2 className="font-bold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/apps/delivery/project_planner.html" className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm">New SOW</a>
          <a href="/admin/legacy/contract_ledger.html" className="px-4 py-2 bg-brandNavy-800 rounded text-sm border border-brandNavy-700">Contract Ledger</a>
          <a href="/workspace/" className="px-4 py-2 bg-brandNavy-800 rounded text-sm border border-brandNavy-700">Deploy Workspace</a>
          <a href="/admin/legacy/index.html" className="px-4 py-2 bg-brandNavy-800 rounded text-sm border border-brandNavy-700">Full Suite Launcher</a>
        </div>
      </div>
    </div>
  );
}
