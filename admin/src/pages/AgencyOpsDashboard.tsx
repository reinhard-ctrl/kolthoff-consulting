import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { adminCol } from '../lib/firebase';
import { useTenantBranding } from '../hooks/useTenantBranding';

import { useProduct } from '../lib/product-context';

export default function AgencyOpsDashboard() {
  const { branding } = useTenantBranding();
  const product = useProduct();
  const modules = product.moduleLabels;
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
    { label: 'Active deals', value: stats.deals, to: '/app/crm-pipeline', hint: 'Pipeline overview' },
    { label: 'Open quotes', value: stats.profiles, to: '/app/project-planner', hint: 'Quotes in progress' },
    { label: 'Invoices', value: stats.invoices, to: '/collections', hint: 'Accounts receivable' },
    { label: 'Needs follow-up', value: stats.overdue, to: '/collections', hint: 'Partial or overdue' },
  ];

  const workflow = [
    { step: '1', title: modules.sales, desc: 'Track inquiries from first contact to closed deal.', to: '/app/crm-pipeline' },
    { step: '2', title: modules.quotes, desc: 'Build quotes with VAT and milestone billing.', to: '/app/project-planner' },
    { step: '3', title: modules.invoicing, desc: 'Issue invoices, record payments, and export for your bookkeeper.', to: '/collections' },
  ];

  return (
    <div className="ops-main-inner">
      <header className="ops-page-header mb-6">
        <h1>Dashboard</h1>
        <p>Quote-to-cash workflow — from first lead to collected payment.</p>
      </header>

      <div className="ops-callout mb-8 px-4 py-3.5">
        <p className="text-sm leading-relaxed">
          Sample data is included for demos. Customize your logo, company name, and brand color in{' '}
          <Link to="/settings/branding" style={{ color: branding.primaryColor }}>
            Company Branding
          </Link>.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="ops-card ops-stat-card glass-panel p-5 block pl-6">
            <div className="ops-stat-label">{c.label}</div>
            <div className="ops-stat-value mt-2">{c.value}</div>
            <div className="ops-stat-hint mt-1">{c.hint}</div>
          </Link>
        ))}
      </div>

      <h2 className="ops-section-title">Getting started</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {workflow.map((item) => (
          <Link key={item.step} to={item.to} className="ops-card ops-step-card glass-panel p-5 block">
            <div className="ops-step-num">{item.step}</div>
            <h3>{item.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
