import { useEffect, useState } from 'react';
import { onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { adminCol } from '../lib/firebase';

interface IntakeForm {
  id: string;
  title: string;
  profileId: string;
  status: string;
  createdAt: string;
}

export default function IntakeCenter() {
  const [forms, setForms] = useState<IntakeForm[]>([]);

  useEffect(() => {
    return onSnapshot(adminCol('intake_forms'), (snap) => {
      const list: IntakeForm[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as IntakeForm));
      setForms(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    });
  }, []);

  const copyLink = (formId: string) => {
    const url = `${window.location.origin}/apps/public/client_intake.html?form=${formId}`;
    navigator.clipboard.writeText(url);
    alert('Intake link copied!');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Intake Center</h1>
      <p className="text-sm text-slate-400 mb-4">
        Manage client intake forms. For full template builder, use{' '}
        <a href="/admin/legacy/intake_center.html" className="text-brandTeal-400 underline">Legacy Intake Center</a>.
      </p>
      <div className="space-y-3">
        {forms.map((f) => (
          <div key={f.id} className="glass-panel p-4 flex justify-between items-center">
            <div>
              <div className="font-bold">{f.title}</div>
              <div className="text-xs text-slate-500">Profile: {f.profileId} · {f.status}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => copyLink(f.id)} className="px-3 py-1 bg-brandTeal-500/20 text-brandTeal-400 rounded text-xs">Copy Link</button>
              <button onClick={() => deleteDoc(doc(adminCol('intake_forms'), f.id))} className="px-3 py-1 text-red-400 rounded text-xs">Delete</button>
            </div>
          </div>
        ))}
        {forms.length === 0 && <p className="text-slate-500 italic">No intake forms yet.</p>}
      </div>
    </div>
  );
}
