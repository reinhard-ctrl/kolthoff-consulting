import { useState } from 'react';
import { setDoc, tenantCol, tenantDoc, logAudit } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

/** Matches ops CRM pipeline stages (crm_pipeline.html) */
const STAGES = [
  'Lead / Prospect',
  'Meeting',
  'Proposal',
  'Negotiation',
  'Closed Won/Lost',
] as const;

const STAGE_COLORS: Record<string, string> = {
  'Lead / Prospect': 'bg-slate-100',
  Meeting: 'bg-blue-50',
  Proposal: 'bg-amber-50',
  Negotiation: 'bg-purple-50',
  'Closed Won/Lost': 'bg-green-50',
};

interface Deal {
  id: string;
  leadName?: string;
  company?: string;
  pipelineStatus: string;
  estValue?: number;
  notes?: string;
  /** Legacy workspace field — normalized on read */
  stage?: string;
  value?: number;
  title?: string;
}

function dealStage(deal: Deal): string {
  return deal.pipelineStatus || deal.stage || STAGES[0];
}

function dealValue(deal: Deal): number {
  return deal.estValue ?? deal.value ?? 0;
}

function dealTitle(deal: Deal): string {
  if (deal.leadName) return deal.leadName;
  if (deal.title) return deal.title;
  return 'New Opportunity';
}

export default function CRMApp({ currentUserId }: { currentUserId: string }) {
  const { data: deals } = useFirestoreCollection<Deal>(tenantCol('crm_deals'));

  const addDeal = async () => {
    const id = `deal_${Date.now()}`;
    await setDoc(tenantDoc('crm_deals', id), {
      id,
      leadName: 'New Opportunity',
      company: '',
      estValue: 0,
      pipelineStatus: STAGES[0],
      ownerId: currentUserId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await logAudit('crm_deal_create', { dealId: id });
  };

  const update = async (deal: Deal, field: string, value: unknown) => {
    await setDoc(tenantDoc('crm_deals', deal.id), { [field]: value, updatedAt: Date.now() }, { merge: true });
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
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">{stage}</h3>
            <div className="space-y-2">
              {deals.filter((d) => dealStage(d) === stage).map((deal) => (
                <div key={deal.id} className={`p-3 rounded-lg border ${STAGE_COLORS[stage] || 'bg-slate-50'}`}>
                  <input value={dealTitle(deal)} onChange={(e) => update(deal, 'leadName', e.target.value)}
                    className="font-semibold w-full bg-transparent text-sm outline-none" />
                  <input value={deal.company || ''} onChange={(e) => update(deal, 'company', e.target.value)}
                    placeholder="Company" className="text-xs w-full bg-transparent mt-1 outline-none" />
                  <input type="number" value={dealValue(deal)} onChange={(e) => update(deal, 'estValue', +e.target.value)}
                    className="text-xs w-full bg-transparent mt-1 outline-none" />
                  <select value={dealStage(deal)} onChange={(e) => update(deal, 'pipelineStatus', e.target.value)}
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
