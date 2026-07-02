import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { adminCol } from '../lib/firebase';
import QuickActionsBar from '../components/QuickActionsBar';

export default function Dashboard() {
  const [stats, setStats] = useState({ clients: 0, profiles: 0, contracts: 0, invoices: 0, intake: 0, tickets: 0 });

  useEffect(() => {
    const cols: (keyof typeof stats)[] = ['clients', 'workbook_profiles', 'contracts_ledger', 'invoices', 'intake_forms', 'core_it_requests'];
    const unsubs = cols.map((col) =>
      onSnapshot(
        adminCol(col),
        (snap) => setStats((s) => ({
          ...s,
          [col === 'workbook_profiles' ? 'profiles'
            : col === 'contracts_ledger' ? 'contracts'
            : col === 'intake_forms' ? 'intake'
            : col === 'core_it_requests' ? 'tickets'
            : col]: snap.size,
        })),
        (err) => console.warn(`Dashboard listener failed (${col}):`, err.message)
      )
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const cards = [
    { label: 'Client Portals', value: stats.clients, to: '/portals' },
    { label: 'SOW Profiles', value: stats.profiles, to: '/app/project-planner' },
    { label: 'Contracts', value: stats.contracts, to: '/contracts' },
    { label: 'Invoices', value: stats.invoices, to: '/collections' },
    { label: 'Intake Forms', value: stats.intake, to: '/intake' },
    { label: 'IT Tickets', value: stats.tickets, to: '/master' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Operations Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="glass-panel p-5 hover:border-brandTeal-500/50 transition-colors block">
            <div className="text-xs text-slate-500 uppercase">{c.label}</div>
            <div className="text-3xl font-bold text-brandTeal-400 mt-1">{c.value}</div>
          </Link>
        ))}
      </div>
      <QuickActionsBar />
    </div>
  );
}
