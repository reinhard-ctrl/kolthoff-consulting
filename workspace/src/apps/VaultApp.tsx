import { useState } from 'react';
import { marked } from 'marked';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { tenantCol } from '../lib/firebase';

interface Policy {
  id: string;
  title: string;
  content: string;
  lastUpdated?: string;
}

export default function VaultApp() {
  const { data: policies, loading } = useFirestoreCollection<Policy>(tenantCol('core_policies'));
  const [active, setActive] = useState<string | null>(null);

  const activeId = active || policies[0]?.id || null;
  const current = policies.find((p) => p.id === activeId);

  if (loading) return <div className="p-6 text-slate-400">Loading policies...</div>;

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-slate-200 bg-white p-4 overflow-y-auto">
        <h2 className="font-bold text-sm text-slate-500 mb-3">Company Policies</h2>
        {policies.map((p) => (
          <button key={p.id} onClick={() => setActive(p.id)}
            className={`block w-full text-left p-2 rounded-lg text-sm mb-1 ${activeId === p.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'}`}>
            {p.title}
          </button>
        ))}
        {policies.length === 0 && <p className="text-xs text-slate-400">No policies published yet. Use Policy Studio to create.</p>}
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        {current ? (
          <>
            <h1 className="text-2xl font-bold mb-2">{current.title}</h1>
            {current.lastUpdated && <p className="text-xs text-slate-400 mb-4">Updated: {current.lastUpdated}</p>}
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(current.content || '') as string }} />
          </>
        ) : (
          <p className="text-slate-400">Select a policy to view</p>
        )}
      </div>
    </div>
  );
}
