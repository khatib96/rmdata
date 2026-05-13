import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Calculator,
  FileText,
  FolderOpen,
  History,
  Landmark,
} from 'lucide-react';

export const TAB_IDS = ['main', 'branches', 'vat', 'corporate', 'summary', 'documents', 'history'] as const;
export type TabId = (typeof TAB_IDS)[number];

export function getTabs(t: (k: string) => string) {
  return [
    { id: 'main' as const, label: t('entities.tabMain'), icon: FileText },
    { id: 'branches' as const, label: t('entities.tabBranches'), icon: Building2 },
    { id: 'vat' as const, label: t('entities.tabVat'), icon: FileText },
    { id: 'corporate' as const, label: t('entities.tabCorporate'), icon: Landmark },
    { id: 'summary' as const, label: t('entities.tabSummary'), icon: Calculator },
    { id: 'documents' as const, label: t('entities.tabDocuments'), icon: FolderOpen },
    { id: 'history' as const, label: t('entities.tabHistory'), icon: History },
  ] as { id: TabId; label: string; icon: LucideIcon }[];
}

export interface EntityDetails {
  id: number;
  entityNickname?: string;
  name: string;
  nameEn?: string;
  mainBranchId?: number;
  registeredAddress?: string;
  contactNumber?: string;
  trn?: string;
  vatRegDate?: string;
  vatFilingCycle?: string;
  corporateTaxGiban?: string;
  corporateTaxRegDate?: string;
  financialYearEnd?: string;
  notes?: string;
}

export interface LinkedBranch {
  branchId: number;
  branchName: string;
  tradeName?: string;
  tradeNameEn?: string;
  licenseNo?: string;
  isMain: boolean;
}

export interface TaxPayment {
  id: number;
  type: string;
  financialYear: number;
  quarter?: number;
  periodFrom?: string;
  periodTo?: string;
  amount: number;
  paymentDate: string;
}

export const QUARTERS = [
  { q: 1, label: 'Q1', from: '01-01', to: '03-31' },
  { q: 2, label: 'Q2', from: '04-01', to: '06-30' },
  { q: 3, label: 'Q3', from: '07-01', to: '09-30' },
  { q: 4, label: 'Q4', from: '10-01', to: '12-31' },
];

export const MIN_TAX_YEAR = 2018;
