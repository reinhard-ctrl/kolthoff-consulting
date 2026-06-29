import { useState } from 'react';
import { setDoc, tenantCol, tenantDoc, logAudit } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-slate-100', qualified: 'bg-blue-50', proposal: 'bg-amber-50',
  negotiation: 'bg-purple-50', won: 'bg-green-50', lost: 'bg-red-50',
};

interface Deal {
  id: string;
  title: string;
  company?: string;
  contact?: string;
  value?: number;
  stage: string;
  notes?: string;
}

export default function CRMApp({ currentUserId }: { currentUserId: string }) {
  const { data: deals } = useFirestoreCollection<Deal>(tenantCol('core_crm_deals'));

  const addDeal = async () => {
    const id = `deal_${Date.now()}`;
    await setDoc(tenantDoc('core_crm_deals', id), {
      id, title: 'New Opportunity', company: '', value: 0, stage: 'lead',
      ownerId: currentUserId, createdAt: Date.now(), updatedAt: Date.now(),
    });
    await logAudit('crm_deal_create', { dealId: id });
  };

  const update = async (deal: Deal, field: string, value: unknown) => {
    await setDoc(tenantDoc('core_crm_deals', deal.id), { [field]: value, updatedAt: Date.now() }, { merge: true });
  };

  return (
    <div className="p-4 h-full overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">CRM Pipeline</h2>
        <button onClick={addDeal} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">+ New Deal</button>
      </div>
      <div className="flex gap-3 min-h-[400px]">
        {STAGES.map((stage) => (
          <div key={stage} className="min-w-[200px] flex-shrink-0">
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2 capitalize">{stage}</h3>
            <div className="space-y-2">
              {deals.filter((d) => d.stage === stage).map((deal) => (
                <div key={deal.id} className={`p-3 rounded-lg border ${STAGE_COLORS[stage]}`}>
                  <input value={deal.title} onChange={(e) => update(deal, 'title', e.target.value)}
                    className="font-semibold w-full bg-transparent text-sm outline-none" />
                  <input value={deal.company || ''} onChange={(e) => update(deal, 'company', e.target.value)}
                    placeholder="Company" className="text-xs w-full bg-transparent mt-1 outline-none" />
                  <input type="number" value={deal.value || 0} onChange={(e) => update(deal, 'value', +e.target.value)}
                    className="text-xs w-full bg-transparent mt-1 outline-none" />
                  <select value={deal.stage} onChange={(e) => update(deal, 'stage', e.target.value)}
                    className="text-xs mt-2 w-full rounded border p-1">
                    {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
