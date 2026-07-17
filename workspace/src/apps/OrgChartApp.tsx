import { useMemo, useState } from 'react';
import { deleteDoc, setDoc } from 'firebase/firestore';
import { logAudit, tenantCol, tenantDoc } from '../lib/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import {
  type OrgDepartment,
  type OrgPerson,
  type OrgTreeNode,
  buildOrgTree,
  collectOrgRoles,
  createDeptId,
  isDescendant,
} from '../lib/org-structure';

function TreeBranch({
  node,
  depth,
  deptName,
}: {
  node: OrgTreeNode;
  depth: number;
  deptName: (id?: string | null) => string;
}) {
  return (
    <div className={depth === 0 ? '' : 'ml-5 border-l border-slate-200 pl-3'}>
      <div className="ws-panel mb-2 p-3">
        <div className="font-semibold text-sm text-slate-900">{node.name || node.email || node.id}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {[node.jobTitle || node.orgRole, deptName(node.departmentId)].filter(Boolean).join(' · ') || 'No title'}
        </div>
        {node.orgRole && (
          <span className="ws-chip bg-brandTeal-500/15 text-brandTeal-700 mt-2">{node.orgRole}</span>
        )}
      </div>
      {node.children.map((child) => (
        <TreeBranch key={child.id} node={child} depth={depth + 1} deptName={deptName} />
      ))}
    </div>
  );
}

export default function OrgChartApp({
  currentUserId,
  canEdit,
}: {
  currentUserId: string;
  canEdit: boolean;
}) {
  const { data: peopleRaw } = useFirestoreCollection<OrgPerson>(tenantCol('core_users'));
  const { data: departments } = useFirestoreCollection<OrgDepartment>(tenantCol('core_departments'));
  const people = useMemo(() => peopleRaw as OrgPerson[], [peopleRaw]);

  const [tab, setTab] = useState<'chart' | 'people' | 'departments'>('chart');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptParent, setDeptParent] = useState('');
  const [deptHead, setDeptHead] = useState('');

  const tree = useMemo(() => buildOrgTree(people), [people]);
  const orgRoles = useMemo(() => collectOrgRoles(people), [people]);
  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const nameOfDept = (id?: string | null) => (id ? deptById.get(id)?.name || id : '—');

  const savePerson = async (person: OrgPerson, patch: Partial<OrgPerson>) => {
    if (!canEdit) return;
    if (patch.managerId && (patch.managerId === person.id || isDescendant(people, person.id, patch.managerId))) {
      setError('Invalid manager: would create a reporting cycle.');
      return;
    }
    setBusy(true);
    setError('');
    setOk('');
    try {
      await setDoc(tenantDoc('core_users', person.id), { ...patch, updatedAt: Date.now() }, { merge: true });
      await logAudit('org_person_update', { userId: person.id, fields: Object.keys(patch) });
      setOk('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const addDepartment = async () => {
    if (!canEdit || !deptName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const id = createDeptId(deptName);
      await setDoc(tenantDoc('core_departments', id), {
        id,
        name: deptName.trim(),
        parentId: deptParent || null,
        headUserId: deptHead || null,
        updatedAt: Date.now(),
      });
      await logAudit('org_department_create', { departmentId: id });
      setDeptName('');
      setDeptParent('');
      setDeptHead('');
      setOk('Department created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const saveDepartment = async (dept: OrgDepartment, patch: Partial<OrgDepartment>) => {
    if (!canEdit) return;
    setBusy(true);
    setError('');
    try {
      await setDoc(tenantDoc('core_departments', dept.id), { ...patch, updatedAt: Date.now() }, { merge: true });
      setOk('Department updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const removeDepartment = async (id: string) => {
    if (!canEdit || !window.confirm('Delete this department? People keep their user records.')) return;
    await deleteDoc(tenantDoc('core_departments', id));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="ws-page">
        <header className="mb-5">
          <h1 className="ws-title">Organization</h1>
          <p className="ws-subtitle">
            Define departments, job titles, org roles, and reporting lines. Approval workflows use this to route
            to a manager, department head, or role — like Lark.
          </p>
        </header>

        <div className="flex flex-wrap gap-1 mb-4">
          {([
            ['chart', 'Org chart'],
            ['people', 'People & roles'],
            ['departments', 'Departments'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`ws-tab ${tab === id ? 'ws-tab-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {!canEdit && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
            View only. Ask a workspace admin to update the org chart.
          </p>
        )}
        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
        {ok && <p className="text-sm text-emerald-700 mb-3">{ok}</p>}

        {tab === 'chart' && (
          <div className="max-w-2xl">
            {tree.length === 0 && (
              <p className="text-sm text-slate-400 italic">No people yet. Invite users, then set managers under People & roles.</p>
            )}
            {tree.map((node) => (
              <TreeBranch key={node.id} node={node} depth={0} deptName={nameOfDept} />
            ))}
            {orgRoles.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-slate-500 mb-2">Org roles in use</h2>
                <div className="flex flex-wrap gap-2">
                  {orgRoles.map((role) => (
                    <span key={role} className="ws-chip bg-slate-100 text-slate-700">{role}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'people' && (
          <div className="space-y-3">
            {people.map((person) => (
              <div key={person.id} className="ws-panel p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="md:col-span-2 lg:col-span-3">
                  <div className="font-semibold text-sm">{person.name || person.email || person.id}</div>
                  <div className="text-xs text-slate-500">{person.email} · ACL: {person.role || 'user'}</div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Job title</label>
                  <input
                    defaultValue={person.jobTitle || ''}
                    disabled={!canEdit || busy}
                    className="ws-input mt-1"
                    onBlur={(e) => {
                      if (e.target.value !== (person.jobTitle || '')) {
                        void savePerson(person, { jobTitle: e.target.value.trim() });
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Org role (for approvals)</label>
                  <input
                    defaultValue={person.orgRole || ''}
                    disabled={!canEdit || busy}
                    className="ws-input mt-1"
                    placeholder="e.g. Finance Approver"
                    list="org-role-suggestions"
                    onBlur={(e) => {
                      if (e.target.value !== (person.orgRole || '')) {
                        void savePerson(person, { orgRole: e.target.value.trim() });
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Department</label>
                  <select
                    value={person.departmentId || ''}
                    disabled={!canEdit || busy}
                    className="ws-input mt-1"
                    onChange={(e) => void savePerson(person, { departmentId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] text-slate-500">Reports to (manager)</label>
                  <select
                    value={person.managerId || ''}
                    disabled={!canEdit || busy}
                    className="ws-input mt-1"
                    onChange={(e) => void savePerson(person, { managerId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {people
                      .filter((p) => p.id !== person.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>{p.name || p.email || p.id}</option>
                      ))}
                  </select>
                </div>
                {person.id === currentUserId && (
                  <p className="md:col-span-3 text-[11px] text-slate-400">This is your profile.</p>
                )}
              </div>
            ))}
            <datalist id="org-role-suggestions">
              {orgRoles.map((role) => (
                <option key={role} value={role} />
              ))}
            </datalist>
          </div>
        )}

        {tab === 'departments' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="space-y-3">
              {departments.map((dept) => (
                <div key={dept.id} className="ws-panel p-4 space-y-2">
                  <div className="font-semibold text-sm">{dept.name}</div>
                  <label className="text-[11px] text-slate-500 block">Parent department</label>
                  <select
                    value={dept.parentId || ''}
                    disabled={!canEdit || busy}
                    className="ws-input"
                    onChange={(e) => void saveDepartment(dept, { parentId: e.target.value || null })}
                  >
                    <option value="">None (top level)</option>
                    {departments.filter((d) => d.id !== dept.id).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <label className="text-[11px] text-slate-500 block">Department head (approver)</label>
                  <select
                    value={dept.headUserId || ''}
                    disabled={!canEdit || busy}
                    className="ws-input"
                    onChange={(e) => void saveDepartment(dept, { headUserId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>{p.name || p.email || p.id}</option>
                    ))}
                  </select>
                  {canEdit && (
                    <button type="button" onClick={() => removeDepartment(dept.id)} className="text-xs text-rose-600">
                      Delete department
                    </button>
                  )}
                </div>
              ))}
              {departments.length === 0 && (
                <p className="text-sm text-slate-400 italic">No departments yet.</p>
              )}
            </section>

            {canEdit && (
              <section className="ws-panel p-5 h-fit">
                <h2 className="text-sm font-semibold mb-3">Add department</h2>
                <label className="text-[11px] text-slate-500">Name</label>
                <input value={deptName} onChange={(e) => setDeptName(e.target.value)} className="ws-input mb-3" />
                <label className="text-[11px] text-slate-500">Parent</label>
                <select value={deptParent} onChange={(e) => setDeptParent(e.target.value)} className="ws-input mb-3">
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <label className="text-[11px] text-slate-500">Head</label>
                <select value={deptHead} onChange={(e) => setDeptHead(e.target.value)} className="ws-input mb-4">
                  <option value="">—</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name || p.email}</option>
                  ))}
                </select>
                <button type="button" onClick={addDepartment} disabled={busy || !deptName.trim()} className="ws-btn-primary disabled:opacity-50">
                  Create department
                </button>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
