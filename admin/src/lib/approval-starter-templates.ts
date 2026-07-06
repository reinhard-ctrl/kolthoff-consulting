import { doc, setDoc } from 'firebase/firestore';
import { db, adminAppId } from './firebase';

export interface StarterTemplate {
  id: string;
  name: string;
  type: string;
  fields: { id: string; label: string; type: string; required?: boolean; options?: string[] }[];
  flowSteps: { id: string; type: string; label: string; assigneeType?: string; role?: string }[];
}

export const STARTER_APPROVAL_TEMPLATES: StarterTemplate[] = [
  {
    id: 'tpl-leave',
    name: 'Leave Request',
    type: 'approval',
    fields: [
      { id: 'startDate', label: 'Start date', type: 'date', required: true },
      { id: 'endDate', label: 'End date', type: 'date', required: true },
      { id: 'leaveType', label: 'Leave type', type: 'select', required: true, options: ['Vacation', 'Sick', 'Personal', 'Other'] },
      { id: 'reason', label: 'Reason', type: 'textarea', required: true },
    ],
    flowSteps: [{ id: 'mgr', type: 'approval', label: 'Manager approval', assigneeType: 'any_admin' }],
  },
  {
    id: 'tpl-expense',
    name: 'Expense Reimbursement',
    type: 'approval',
    fields: [
      { id: 'amount', label: 'Amount (PHP)', type: 'number', required: true },
      { id: 'category', label: 'Category', type: 'select', required: true, options: ['Travel', 'Meals', 'Supplies', 'Software', 'Other'] },
      { id: 'description', label: 'Description', type: 'textarea', required: true },
      { id: 'receiptDate', label: 'Receipt date', type: 'date', required: true },
    ],
    flowSteps: [{ id: 'finance', type: 'approval', label: 'Finance approval', assigneeType: 'any_admin' }],
  },
  {
    id: 'tpl-access',
    name: 'Access / Tool Request',
    type: 'approval',
    fields: [
      { id: 'tool', label: 'Tool or system', type: 'text', required: true },
      { id: 'accessLevel', label: 'Access level', type: 'select', required: true, options: ['Read', 'Edit', 'Admin'] },
      { id: 'justification', label: 'Business justification', type: 'textarea', required: true },
    ],
    flowSteps: [{ id: 'it', type: 'approval', label: 'IT / Admin approval', assigneeType: 'any_admin' }],
  },
  {
    id: 'tpl-document',
    name: 'Document Approval',
    type: 'approval',
    fields: [
      { id: 'documentTitle', label: 'Document title', type: 'text', required: true },
      { id: 'documentType', label: 'Type', type: 'select', required: true, options: ['Policy', 'Contract', 'SOP', 'Other'] },
      { id: 'summary', label: 'Summary', type: 'textarea', required: true },
    ],
    flowSteps: [
      { id: 'review', type: 'approval', label: 'Reviewer approval', assigneeType: 'any_admin' },
      { id: 'final', type: 'approval', label: 'Final sign-off', assigneeType: 'role', role: 'admin' },
    ],
  },
];

export async function seedMasterTemplates(): Promise<number> {
  let count = 0;
  for (const tmpl of STARTER_APPROVAL_TEMPLATES) {
    await setDoc(
      doc(db, 'artifacts', adminAppId, 'public', 'data', 'master_templates', tmpl.id),
      { ...tmpl, updatedAt: Date.now() },
      { merge: true },
    );
    count += 1;
  }
  return count;
}

export async function deployTemplateToTenant(
  tenantId: string,
  template: StarterTemplate | { id: string; name?: string; type?: string; fields?: unknown[]; flowSteps?: unknown[] },
): Promise<void> {
  await setDoc(
    doc(db, 'artifacts', tenantId, 'public', 'data', 'core_templates', template.id),
    { ...template, deployedFrom: template.id, deployedAt: Date.now() },
    { merge: true },
  );
}

export async function deployStarterPackToTenant(tenantId: string): Promise<number> {
  for (const tmpl of STARTER_APPROVAL_TEMPLATES) {
    await deployTemplateToTenant(tenantId, tmpl);
  }
  return STARTER_APPROVAL_TEMPLATES.length;
}
