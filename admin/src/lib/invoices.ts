/** Invoice / collections types and helpers — mirrors shared/invoices.js */

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';

export interface InvoiceAuditEntry {
  action: string;
  timestamp: string;
  detail?: string;
}

export interface InvoiceRecord {
  id: string;
  profileId: string;
  quoteId: string;
  invoiceNumber: string;
  clientCompany: string;
  portalAccessCode: string | null;
  milestoneKey: string;
  milestoneLabel: string;
  subtotal: number;
  vat: number;
  total: number;
  includeTax: boolean;
  billingPeriod?: string | null;
  amountPaid: number;
  status: InvoiceStatus | string;
  issueDate: string;
  dueDate: string;
  sentAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  notes: string | null;
  documentLink: string | null;
  createdAt: number;
  updatedAt: number;
  auditTrail: InvoiceAuditEntry[];
}

export interface Withholding2307Record {
  id: string;
  clientCompany: string;
  profileId?: string;
  period: string;
  amount: number;
  receivedDate: string;
  certificateRef?: string;
  notes?: string;
  createdAt: number;
}

export {
  INVOICE_STATUSES,
  formatInvoiceNumber,
  buildInvoiceDocId,
  parseDueDate,
  resolveMilestoneLabel,
  computeInvoiceAmounts,
  computeEffectiveStatus,
  portalStatusLabel,
  buildInvoiceRecord,
  applyPaymentUpdate,
  mapInvoiceToPortalContract,
  mergePortalContractsFromInvoices,
  isDueWithinDays,
  isOverdue,
  outstandingAmount,
  invoicesToCsv,
  withholding2307ToCsv,
} from '../../../shared/invoices.js';
