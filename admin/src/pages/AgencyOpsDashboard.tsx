import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { adminCol } from '../lib/firebase';
import { useProduct } from '../lib/product-context';

export default function AgencyOpsDashboard() {
  const product = useProduct();
  const [stats, setStats] = useState({ deals: 0, profiles: 0, invoices: 0, overdue: 0 });

  useEffect(() => {
    const unsubs = [
      onSnapshot(adminCol('crm_deals'), (snap) => {
        setStats((s) => ({ ...s, deals: snap.size }));
      }),
      onSnapshot(adminCol('workbook_profiles'), (snap) => {
        setStats((s) => ({ ...s, profiles: snap.size }));
      }),
      onSnapshot(adminCol('invoices'), (snap) => {
        const docs = snap.docs.map((d) => d.data());
        const overdue = docs.filter((inv) => inv.status === 'overdue' || inv.status === 'partial').length;
        setStats((s) => ({ ...s, invoices: snap.size, overdue }));
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const cards = [
    { label: 'Active Deals', value: stats.deals, to: '/app/crm-pipeline', hint: 'Pipeline overview' },
    { label: 'Open Estimates', value: stats.profiles, to: '/app/project-planner', hint: 'Quotes in progress' },
    { label: 'Invoices', value: stats.invoices, to: '/collections', hint: 'AR register' },
    { label: 'Needs Follow-up', value: stats.overdue, to: '/collections', hint: 'Partial or overdue' },
  ];

  const demoFlow = [
    { step: '1', title: 'CRM Pipeline', desc: 'Track inquiries from first contact to closed deal.', to: '/app/crm-pipeline' },
    { step: '2', title: 'Estimates', desc: 'Build line-item quotes with VAT and milestone billing.', to: '/app/project-planner' },
    { step: '3', title: 'Collections', desc: 'Issue invoices, record payments, and export for your bookkeeper.', to: '/collections' },
  ];

  return (
    <div>
      {product.isDemo && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-amber-200 font-medium">
            This is a live demo of Agency Ops Starter — sample agency data, ready for sales walkthroughs.
          </p>
          {product.demoPasscodeHint && (
            <p className="text-xs text-amber-200/70 mt-1 font-mono">{product.demoPasscodeHint}</p>
          )}
        </div>
      )}

      <h1 className="text-2xl font-bold mb-2">Agency Dashboard</h1>
      <p className="text-slate-400 text-sm mb-6">Quote-to-cash in one place — from first lead to collected payment.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="glass-panel p-5 hover:border-brandTeal-500/50 transition-colors block">
            <div className="text-xs text-slate-500 uppercase">{c.label}</div>
            <div className="text-3xl font-bold text-brandTeal-400 mt-1">{c.value}</div>
            <div className="text-[10px] text-slate-600 mt-1">{c.hint}</div>
          </Link>
        ))}
      </div>

      <h2 className="text-lg font-bold mb-4">Demo walkthrough</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {demoFlow.map((item) => (
          <Link key={item.step} to={item.to} className="glass-panel p-5 hover:border-brandTeal-500/40 transition-colors block">
            <div className="text-brandTeal-500 font-mono text-xs font-bold mb-2">STEP {item.step}</div>
            <div className="font-bold text-white mb-1">{item.title}</div>
            <p className="text-sm text-slate-400">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
