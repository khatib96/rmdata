import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  FileText,
  Users,
  FolderOpen,
  History,
  Clock,
  Landmark,
  Pencil,
  Archive,
  Trash2,
  Eye,
  Download,
  Image as ImageIcon,
  File,
  Store,
  Globe,
  AlertTriangle,
  Phone,
  Smartphone,
  User,
  type LucideIcon,
} from 'lucide-react';
import { getEmirateLabel } from '../../constants/uae';
import { BRANCH_TYPES, type BranchTypeValue, isOfficeOrWebsite } from '../../constants/branchTypes';
import { getExpiryStatus, getExpiryBadgeClass } from '../../utils/expiryStatus';
import { getWorkStatusBadgeClass } from '../../utils/workStatusBadge';
import { getDocumentDisplayName } from '../../utils/documentHelpers';
import { ContractType, EmploymentStatus, LoanType, LoanSubStatus } from '../../constants/employee';

function useLoanSubLabels(t: (k: string) => string): Record<string, string> {
  return {
    [LoanSubStatus.ACTIVE]: t('branches.loanActive'),
    [LoanSubStatus.LEAVE]: t('branches.loanLeave'),
    [LoanSubStatus.INACTIVE]: t('branches.loanInactive'),
  };
}
import UpdateExpiryPopup, { type UpdateExpiryConfig, type DocumentLinkConfig } from '../shared/UpdateExpiryPopup';
import UpdateLeaseExpiryModal from './UpdateLeaseExpiryModal';
import HistoryTab from '../shared/HistoryTab';
import DocumentPreviewModal from '../shared/DocumentPreviewModal';
import TabsOrDropdown from '../shared/TabsOrDropdown';
import type { DocumentPreview } from '../../types/documents';
import AddBranchModal from './AddBranchModal';
import WorkshopIcon from '../Icons/WorkshopIcon';
import { logActivity } from '../../utils/activityLog';
import { useAuthStore } from '../../store/authStore';
import {
  getBranchBasicLocationById,
  getBranchById,
  getBranchCustomFields,
  getBranchEmployeesForProfile,
  getBranchEstablishment,
  getBranchEstablishmentPrimaryEmployees,
  getBranchLease,
  getBranchLeaseInstallments,
  getBranchLicense,
  getBranchSecondedEmployees,
  getBranchTaxEntityLink,
} from '../../services/branchService';
import { usePermissions } from '../../hooks/usePermissions';
import {
  canEmployeesFieldView,
  canBranchesSensitiveAction,
} from '../../services/permissionsService';
import {
  canBranchUiTab,
  canBranchFieldInTab,
  canBranchFieldView,
  filterBranchDocumentsByPermissions,
  type BranchProfileTabId,
} from '../../services/branchPermissions';

type BranchTypeIconComponent = React.ComponentType<{ size?: number; className?: string }>;
const BRANCH_TYPE_ICONS: Record<BranchTypeValue, LucideIcon | BranchTypeIconComponent> = {
  store: Store,
  workshop: WorkshopIcon,
  office: Building2,
  website: Globe,
};

const TAB_IDS = [
  { id: 'basic' as const, labelKey: 'branches.profileTabBasic', icon: Building2 },
  { id: 'licenses' as const, labelKey: 'branches.profileTabLicenses', icon: FileText },
  { id: 'entity' as const, labelKey: 'branches.profileTabEntity', icon: Landmark },
  { id: 'employees' as const, labelKey: 'branches.profileTabEmployees', icon: Users },
  { id: 'employers' as const, labelKey: 'branches.profileTabEmployers', icon: User },
  { id: 'history' as const, labelKey: 'branches.profileTabHistory', icon: History },
  { id: 'documents' as const, labelKey: 'branches.profileTabDocuments', icon: FolderOpen },
  { id: 'phones' as const, labelKey: 'branches.profileTabPhones', icon: Phone },
];

type TabId = (typeof TAB_IDS)[number]['id'];

function isExpired(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isWithin30Days(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
}

function shouldShowUpdateButton(dateStr: string | undefined): boolean {
  return !!dateStr && (isExpired(dateStr) || isWithin30Days(dateStr));
}

function isTimeInRange(now: Date, from: string, to: string): boolean {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const fromMin = fh * 60 + fm;
  let toMin = th * 60 + tm;
  if (toMin <= fromMin) toMin += 24 * 60;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let nowMin24 = nowMin;
  if (nowMin < fromMin) nowMin24 += 24 * 60;
  return nowMin24 >= fromMin && nowMin24 <= toMin;
}

function computeLiveStatus(workTimingSlots: string | undefined, status: string | undefined): 'Open' | 'Closed' {
  if (status === 'suspended') return 'Closed';
  if (!workTimingSlots) return 'Closed';
  try {
    if (workTimingSlots.includes('"_24h":true') || workTimingSlots.includes('"_24h": true')) return 'Open';
  } catch {}
  const now = new Date();
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const currentDay = dayKeys[now.getDay()];
  try {
    if (workTimingSlots.startsWith('{')) {
      const schedule = JSON.parse(workTimingSlots) as Record<string, { enabled?: boolean; slots?: { from: string; to: string }[] }>;
      const day = schedule[currentDay];
      if (!day?.enabled || !day.slots?.length) return 'Closed';
      for (const slot of day.slots) {
        if (slot.from && slot.to && isTimeInRange(now, slot.from, slot.to)) return 'Open';
      }
      return 'Closed';
    }
    const slots = workTimingSlots.split(',').map((s) => s.trim());
    for (const slot of slots) {
      const [from, to] = slot.split('-').map((x) => x.trim());
      if (from && to && isTimeInRange(now, from, to)) return 'Open';
    }
  } catch {}
  return 'Closed';
}

function getBranchTypeLabel(value: string, t: (k: string) => string): string {
  const found = BRANCH_TYPES.find((bt) => bt.value === value);
  return found ? t(`branches.${found.value}`) : value;
}

function BranchEmployeeAvatar({ path, name }: { path: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!window.electronAPI?.fileGetImageUrl) return;
    window.electronAPI.fileGetImageUrl(path).then((r) => {
      if (r?.success && r?.url) setSrc(r.url);
    });
  }, [path]);
  if (src) return <img src={src} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />;
  return (
    <div className="w-8 h-8 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-sm shrink-0">
      {name?.charAt(0) || '?'}
    </div>
  );
}

interface BranchDetails {
  id: number;
  code?: string;
  name: string;
  nameEn?: string;
  emirate: string;
  city?: string;
  address?: string;
  phone?: string;
  photoPath?: string;
  branchType: string;
  status: string;
  workTimingSlots?: string;
  license?: { id: number; licenseNo: string; tradeName?: string; issueDate?: string; expiryDate?: string };
  lease?: { id: number; contractNo: string; landlordName?: string; amount?: number; issueDate?: string; expiryDate?: string };
  leaseInstallments?: { id: number; seq: number; amount: number; dueDate?: string; note?: string }[];
  establishment?: Record<string, unknown>;
  customFields?: Array<{ id: number; title: string; content?: string }>;
  /** TRN (VAT) from linked Tax Entity (for Basic Info display) */
  taxEntityTrn?: string;
  /** Corporate Tax registration from linked Tax Entity */
  taxEntityCorporateTax?: string;
  /** للمكتب/الموقع: الفرع المرتبط به */
  attachedToId?: number;
  linkedBranch?: { id: number; name: string; emirate?: string; city?: string; address?: string };
  googleMapUrl?: string;
}

interface BranchEmployee {
  id: number;
  name: string;
  phone?: string;
  profession?: string;
  professionPerContract?: string;
  imagePath?: string;
  actualSalary?: number;
  status?: string;
  loanType?: string;
  loanSubStatus?: string;
  workCardNumber?: string;
  workCardExpiry?: string;
}

/** موظفين المنشأة: إما عقد على المنشأة (contractBranchId) أو معار إليها (loanBranchId) */
interface EstablishmentEmployee {
  id: number;
  name: string;
  imagePath?: string;
  isSecondedToThis: boolean; // true = معار لهذه المنشأة
  contractTypeLabel: string;
  totalSalary?: number;
  professionPerContract: string;
  contractExpiryDate?: string;
  emiratesIdExpiry?: string;
  workStatusLabel: string; // يعمل | معار داخلياً | معار خارجياً
}

export default function BranchProfile() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ar' | 'en';
  const LOAN_SUB_LABELS = useLoanSubLabels(t);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const branchId = id ? parseInt(id, 10) : NaN;
  const { permissions, granularFieldBypass } = usePermissions();

  const branchPerm = useMemo(() => {
    const f = (tab: BranchProfileTabId, key: string) =>
      granularFieldBypass || canBranchFieldInTab(permissions, tab, key);
    return {
      basic: {
        typeStatus: f('basic', 'field.branchTypeAndStatus.view'),
        location: f('basic', 'field.locationEmirateCity.view'),
        contact: f('basic', 'field.branchContact.view'),
        photo: f('basic', 'field.branchPhoto.view'),
        address: f('basic', 'field.branchAddress.view'),
        map: f('basic', 'field.mapLink.view'),
        schedule: f('basic', 'field.workSchedule.view'),
        linked: f('basic', 'field.linkedBranch.view'),
        tax: f('basic', 'field.taxIdentifiers.view'),
      },
      licenses: {
        trade: f('licenses', 'field.tradeLicense.view'),
        leaseMeta: f('licenses', 'field.leaseContractMeta.view'),
        leaseTotal: f('licenses', 'field.leaseTotalContractValue.view'),
        leaseSchedule: f('licenses', 'field.leasePaymentSchedule.view'),
        leaseInstAmounts: f('licenses', 'field.leaseInstallmentAmounts.view'),
        custom: f('licenses', 'field.customEstablishmentSections.view'),
      },
      entity: {
        info: f('entity', 'field.entityInfo.view'),
        emps: f('entity', 'field.establishmentEmployees.view'),
      },
      branchEmps: {
        list: f('employees', 'field.branchEmployeeList.view'),
      },
      employers: {
        list: f('employers', 'field.employerList.view'),
        ownership: f('employers', 'field.employerOwnership.view'),
      },
      phones: {
        list: f('phones', 'field.assignedPhonesList.view'),
      },
      /** معاينة مستندات من تبويب الرخص — لا تعتمد على tab.documents */
      docs: {
        tradeLicense: granularFieldBypass || canBranchFieldView(permissions, 'field.documentsTradeLicense.view'),
        lease: granularFieldBypass || canBranchFieldView(permissions, 'field.documentsLease.view'),
        general: granularFieldBypass || canBranchFieldView(permissions, 'field.documentsGeneral.view'),
      },
    };
  }, [granularFieldBypass, permissions]);

  const showSalaryColumns = useMemo(
    () =>
      granularFieldBypass ||
      (canBranchFieldInTab(permissions, 'employees', 'field.showSalariesInBranchEmployeeTab.view') &&
        canEmployeesFieldView(permissions, 'field.actualSalary.view')),
    [granularFieldBypass, permissions]
  );

  const canDeleteBranchDocs = useMemo(
    () => granularFieldBypass || canBranchesSensitiveAction(permissions, 'deleteBranchDocuments'),
    [granularFieldBypass, permissions]
  );

  const permittedTabs = useMemo(() => TAB_IDS.filter((t) => canBranchUiTab(permissions, t.id)), [permissions]);

  const [branch, setBranch] = useState<BranchDetails | null>(null);
  const [employees, setEmployees] = useState<BranchEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [expiryPopup, setExpiryPopup] = useState<{ config: UpdateExpiryConfig; documentConfig?: DocumentLinkConfig; currentExpiry?: string; title: string; activityLogParams?: { module: string; action: string; entityType: string; entityId?: number; details: string } } | null>(null);
  const [leaseExpiryModalOpen, setLeaseExpiryModalOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  /** عند وجود موظفين مرتبطين: عددهم يمنع الأرشفة/الحذف */
  const [linkedEmployeesCount, setLinkedEmployeesCount] = useState<number | null>(null);
  const [blockReason, setBlockReason] = useState<'archive' | 'delete' | null>(null);
  const [branchDocuments, setBranchDocuments] = useState<{ id: number; relativePath: string; customName: string | null; section: string | null }[]>([]);
  const visibleDocuments = useMemo(
    () => filterBranchDocumentsByPermissions(branchDocuments, permissions),
    [branchDocuments, permissions]
  );
  const licensesTabShowsAnyBlock = useMemo(() => {
    if (!branch) return true;
    const hasLinked = !!(branch.linkedBranch && branchPerm.basic.linked);
    const hasTrade = !!(branch.license && branchPerm.licenses.trade);
    const hasLease = !!(
      branch.lease &&
      (branchPerm.licenses.leaseMeta ||
        branchPerm.licenses.leaseTotal ||
        branchPerm.licenses.leaseSchedule ||
        branchPerm.licenses.leaseInstAmounts)
    );
    const hasCustom = !!(branch.customFields?.length && branchPerm.licenses.custom);
    return hasLinked || hasTrade || hasLease || hasCustom;
  }, [branch, branchPerm]);
  const licensesTabHasNoDataAtAll = useMemo(
    () =>
      !!branch &&
      !branch.linkedBranch &&
      !branch.license &&
      !branch.lease &&
      !(branch.customFields?.length),
    [branch]
  );
  const [docPreview, setDocPreview] = useState<DocumentPreview | null>(null);
  const [establishmentEmployees, setEstablishmentEmployees] = useState<EstablishmentEmployee[]>([]);
  const [entitySubTab, setEntitySubTab] = useState<'entityInfo' | 'entityEmployees'>('entityInfo');
  const [branchPhones, setBranchPhones] = useState<{ id: number; phoneNumber: string; provider: string; category: string; numberType: string; registeredName: string }[]>([]);
  const [branchEmployers, setBranchEmployers] = useState<{ id: number; fullName: string; code?: string; role: string; ownershipPercent?: number | null }[]>([]);

  const loadBranchDetails = async () => {
    if (!window.electronAPI?.dbQuery || isNaN(branchId)) return;
    setLoading(true);
    try {
      const [branchRes, licRes, leaseRes, instRes, estRes, cfRes, empRes, taxLinkRes] = await Promise.all([
        getBranchById(branchId),
        getBranchLicense(branchId),
        getBranchLease(branchId),
        getBranchLeaseInstallments(branchId),
        getBranchEstablishment(branchId),
        getBranchCustomFields(branchId),
        getBranchEmployeesForProfile(
          branchId,
          EmploymentStatus.ACTIVE,
          EmploymentStatus.LEAVE,
          EmploymentStatus.SECONDED,
          LoanType.INTERNAL,
          LoanSubStatus.ACTIVE
        ),
        getBranchTaxEntityLink(branchId),
      ]);
      let taxEntityTrn: string | undefined;
      let taxEntityCorporateTax: string | undefined;
      const link = (taxLinkRes?.data as { entityId?: number }[] | undefined)?.[0];
      if (link?.entityId) {
        const entRes = await window.electronAPI.dbQuery('SELECT trn, corporateTaxGiban FROM entities WHERE id = ?', [link.entityId]);
        const ent = entRes?.data?.[0];
        taxEntityTrn = ent?.trn;
        taxEntityCorporateTax = ent?.corporateTaxGiban;
      }
      const b = (branchRes?.data as unknown as Record<string, unknown>[] | undefined)?.[0];
      let linkedBranch: BranchDetails['linkedBranch'] = undefined;
      const attachedToIdNum =
        b?.attachedToId != null && b.attachedToId !== '' ? Number(b.attachedToId) : NaN;
      if (!Number.isNaN(attachedToIdNum) && attachedToIdNum) {
        const lbRes = await getBranchBasicLocationById(attachedToIdNum);
        const lb = (lbRes?.data as { id: number; name: string; emirate?: string; city?: string; address?: string }[] | undefined)?.[0];
        if (lb) linkedBranch = { id: lb.id, name: lb.name, emirate: lb.emirate, city: lb.city, address: lb.address };
        // TRN/CTRN من الكيان المرتبط بالفرع المادي
        const lbTaxRes = await getBranchTaxEntityLink(attachedToIdNum);
        const lbTax = (lbTaxRes?.data as { entityId?: number }[] | undefined)?.[0];
        if (lbTax?.entityId) {
          const entRes = await window.electronAPI.dbQuery('SELECT trn, corporateTaxGiban FROM entities WHERE id = ?', [lbTax.entityId]);
          const ent = (entRes as any)?.data?.[0];
          if (ent) { taxEntityTrn = ent.trn; taxEntityCorporateTax = ent.corporateTaxGiban; }
        }
      }
      if (!b) {
        setBranch(null);
        setLoading(false);
        return;
      }
      setBranch({
        ...(b as unknown as BranchDetails),
        license: (licRes?.data as BranchDetails['license'][] | undefined)?.[0],
        lease: (leaseRes?.data as BranchDetails['lease'][] | undefined)?.[0],
        leaseInstallments: (instRes?.data as NonNullable<BranchDetails['leaseInstallments']>) ?? [],
        establishment: (estRes?.data as unknown as Record<string, unknown>[] | undefined)?.[0] as BranchDetails['establishment'],
        customFields: Array.isArray(cfRes?.data) ? cfRes.data : [],
        taxEntityTrn,
        taxEntityCorporateTax,
        linkedBranch,
      });
      setEmployees((empRes?.data as BranchEmployee[] | undefined) ?? []);

      // موظفين المنشأة: عقد على المنشأة (contractBranchId) + معارين لها (loanBranchId)
      const estEnabled = (estRes?.data as unknown as Record<string, unknown>[] | undefined)?.[0]?.isEnabled;
      let estEmps: EstablishmentEmployee[] = [];
      if (estEnabled) {
        const [primaryRes, secondedRes] = await Promise.all([
          getBranchEstablishmentPrimaryEmployees(branchId),
          getBranchSecondedEmployees(branchId, EmploymentStatus.SECONDED, LoanType.INTERNAL),
        ]);
        const primary = ((primaryRes?.data as Record<string, unknown>[]) ?? []).map((e: Record<string, unknown>) => {
          const status = e.status as string;
          const loanType = e.loanType as string;
          let workStatusLabel = t('branches.loanActive');
          if (status === EmploymentStatus.SECONDED) {
            workStatusLabel = loanType === LoanType.INTERNAL ? t('branches.internalSecondment') : t('branches.externalSecondment');
          } else if (status === EmploymentStatus.LEAVE) {
            workStatusLabel = t('branches.loanLeave');
          } else if (status === EmploymentStatus.SUSPENDED) {
            workStatusLabel = t('branches.suspended');
          } else if (status === EmploymentStatus.INACTIVE) {
            workStatusLabel = t('branches.loanInactive');
          } else if (status === EmploymentStatus.VISA_CANCELLED) {
            workStatusLabel = t('branches.visaCancel');
          }
          const contractTypeLabel = (e.contractType as string) === ContractType.PERMANENT ? t('branches.permanent') : t('branches.temporary');
          return {
            id: e.id as number,
            name: e.name as string,
            imagePath: e.imagePath as string | undefined,
            isSecondedToThis: false,
            contractTypeLabel,
            totalSalary: e.totalSalary != null ? Number(e.totalSalary) : undefined,
            professionPerContract: (e.professionPerContract as string) || '—',
            contractExpiryDate: e.contractExpiryDate ? String(e.contractExpiryDate).slice(0, 10) : undefined,
            emiratesIdExpiry: e.emiratesIdExpiry ? String(e.emiratesIdExpiry).slice(0, 10) : undefined,
            workStatusLabel,
          } as EstablishmentEmployee;
        });
        const seconded = ((secondedRes?.data as Record<string, unknown>[]) ?? []).map((e: Record<string, unknown>) => {
          const subStatus = e.loanSubStatus as string | undefined;
          const workStatusLabel = subStatus ? (LOAN_SUB_LABELS[subStatus] || subStatus) : t('branches.loanActive');
          return {
            id: e.id as number,
            name: e.name as string,
            imagePath: e.imagePath as string | undefined,
            isSecondedToThis: true,
            contractTypeLabel: t('branches.contractTemporaryInternal'),
            totalSalary: e.loanSalary != null ? Number(e.loanSalary) : undefined,
            professionPerContract: (e.loanProfession as string) || '—',
            contractExpiryDate: e.loanExpiryDate ? String(e.loanExpiryDate).slice(0, 10) : undefined,
            emiratesIdExpiry: e.emiratesIdExpiry ? String(e.emiratesIdExpiry).slice(0, 10) : undefined,
            workStatusLabel,
          } as EstablishmentEmployee;
        });
        estEmps = [...primary, ...seconded];
      }
      setEstablishmentEmployees(estEmps);

      const docRes = await window.electronAPI?.documentList?.('branch', branchId);
      setBranchDocuments(docRes?.success && Array.isArray(docRes.data) ? (docRes.data as any[]).map(d => ({
        id: d.id,
        relativePath: d.relativePath,
        customName: d.customName ?? null,
        section: d.section ?? null
      })) : []);

      const phonesRes = await window.electronAPI.dbQuery(
        `SELECT id, phoneNumber, provider, category, numberType, registeredName 
         FROM phones 
         WHERE assignedBranchId = ? AND (status IS NULL OR status != 'archived')`, 
        [branchId]
      );
      setBranchPhones(phonesRes?.data ?? []);

      const photoPath = typeof b.photoPath === 'string' ? b.photoPath : undefined;
      if (photoPath && window.electronAPI.fileGetImageUrl) {
        const img = await window.electronAPI.fileGetImageUrl(photoPath);
        if (img.success && img.url) setImageUrl(img.url);
      } else setImageUrl(null);
    } catch (e) {
      console.error(e);
      setBranch(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (branchId) loadBranchDetails();
  }, [branchId]);

  useEffect(() => {
    if (activeTab !== 'employers' || !window.electronAPI?.employerGetByBranch || isNaN(branchId)) return;
    window.electronAPI.employerGetByBranch(branchId).then((list: { id: number; fullName: string; code?: string; role: string; ownershipPercent?: number | null }[]) => {
      setBranchEmployers(Array.isArray(list) ? list : []);
    });
  }, [activeTab, branchId]);

  useEffect(() => {
    if (!branch) return;
    const isOfficeOrWeb = isOfficeOrWebsite(branch.branchType);
    const hiddenTabs: TabId[] = [];
    if (isOfficeOrWeb) hiddenTabs.push('entity');
    
    const permittedTabIds = permittedTabs.map((t) => t.id);
    
    if (hiddenTabs.includes(activeTab) || !permittedTabIds.includes(activeTab)) {
      const fallback = permittedTabIds.filter(id => !hiddenTabs.includes(id))[0];
      if (fallback) setActiveTab(fallback);
    }
  }, [branch?.branchType, activeTab, permittedTabs]);

  useEffect(() => {
    if (activeTab === 'entity') {
      if (entitySubTab === 'entityInfo' && !branchPerm.entity.info && branchPerm.entity.emps) setEntitySubTab('entityEmployees');
      if (entitySubTab === 'entityEmployees' && !branchPerm.entity.emps && branchPerm.entity.info) setEntitySubTab('entityInfo');
    }
  }, [activeTab, branchPerm.entity.info, branchPerm.entity.emps, entitySubTab]);

  const handleExpirySaved = () => {
    setExpiryPopup(null);
    loadBranchDetails();
  };

  const user = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const performerLabel = user ? `${user.fullName || user.username}${user.entityId != null ? ` (${user.entityId})` : ''}` : t('branches.system');

  const checkLinkedEmployees = async (): Promise<number> => {
    if (!window.electronAPI?.dbQuery) return 0;
    const res = await window.electronAPI.dbQuery(
      'SELECT COUNT(*) as c FROM employees WHERE (status IS NULL OR status IN (?, ?, ?)) AND (workBranchId = ? OR contractBranchId = ? OR loanBranchId = ?)',
      [EmploymentStatus.ACTIVE, EmploymentStatus.LEAVE, EmploymentStatus.SECONDED, branchId, branchId, branchId]
    );
    const row = (res?.data as { c: number }[] | undefined)?.[0];
    return row?.c ?? 0;
  };

  const handleArchiveClick = async () => {
    const count = await checkLinkedEmployees();
    if (count > 0) {
      setLinkedEmployeesCount(count);
      setBlockReason('archive');
      return;
    }
    setArchiveConfirm(true);
  };

  const handleDeleteClick = async () => {
    const count = await checkLinkedEmployees();
    if (count > 0) {
      setLinkedEmployeesCount(count);
      setBlockReason('delete');
      return;
    }
    setDeleteConfirm(true);
  };

  const handleArchive = async () => {
    if (!window.electronAPI?.archiveRecord) return;
    try {
      const res = await window.electronAPI.archiveRecord(sessionToken, 'branches', branchId);
      if (!res?.success) throw new Error(res?.error || 'ARCHIVE_FAILED');
      const label = branch?.name || branch?.code || `${t('branches.branchFallbackLabel')} ${branchId}`;
      await logActivity({
        module: 'archive',
        action: 'archive',
        entityType: 'branch',
        entityId: branchId,
        details: `archived::branch::${label}::${performerLabel}`,
        performedByUserId: user?.id,
        performedByUsername: user?.fullName || user?.username,
        performedByUserCode: user?.username,
      });
      setArchiveConfirm(false);
      loadBranchDetails();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!window.electronAPI?.archiveDeletePermanent) return;
    try {
      const res = await window.electronAPI.archiveDeletePermanent(sessionToken, 'branches', branchId);
      if (!res?.success) throw new Error(res?.error || 'DELETE_FAILED');
      setDeleteConfirm(false);
      navigate('/dashboard/branches');
    } catch (e) {
      console.error(e);
    }
  };

  if (isNaN(branchId)) {
    navigate('/dashboard/branches');
    return null;
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-secondary-gray">{t('common.loading')}</div>
    );
  }

  if (!branch) {
    return (
      <div className="p-12 text-center">
        <p className="text-red-600 mb-4">{t('branches.viewLoadError')}</p>
        <button
          onClick={() => navigate('/dashboard/branches')}
          className="text-primary-gold hover:underline"
        >
          {t('branches.backToList')}
        </button>
      </div>
    );
  }

  const liveStatus = computeLiveStatus(branch.workTimingSlots, branch.status);
  const canSeeEntityTabIcon = canBranchUiTab(permissions, 'entity');

  return (
    <div className="animate-in fade-in duration-200">
      {/* Top bar: Back arrow only (top right), Edit below header */}
      {/* زر الرجوع: الافتراضي على اليمين (RTL) */}
      <div className="flex justify-start mb-2">
        <button
          onClick={() => navigate('/dashboard/branches')}
          className="p-2 rounded-lg text-dark-charcoal hover:text-primary-gold hover:bg-primary-gold/10 transition-colors"
          aria-label={t('branches.back')}
        >
          <ArrowRight size={24} />
        </button>
      </div>

      {/* بطاقة الفرع: وضع الفرع (يسار أعلى) | صورة/أيقونة واسم | أيقونة المنشأة (يمين أعلى) - فقط عند تفعيل المنشأة */}
      <div className="relative flex flex-row items-center justify-between gap-6 mb-6">
        {branchPerm.basic.typeStatus && (
          <span className={`absolute top-0 left-0 inline-block px-5 py-2.5 rounded-full text-base font-bold shadow-sm z-10 ${liveStatus === 'Open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {liveStatus === 'Open' ? t('branches.open') : t('branches.closed')}
          </span>
        )}
        {canSeeEntityTabIcon && branch.establishment && (branch.establishment as { isEnabled?: number })?.isEnabled && (
          <span className="absolute top-0 right-0 text-primary-gold z-10">
            <Landmark size={28} />
          </span>
        )}
        <div className="shrink-0 pt-10">
          {imageUrl && branchPerm.basic.photo ? (
            <div className="w-24 h-24 rounded-xl overflow-hidden shadow-md">
              <img src={imageUrl} alt={branch.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-xl flex items-center justify-center shrink-0">
              {(() => {
                const typeIcon = branch.branchType && BRANCH_TYPES.some((t) => t.value === branch.branchType)
                  ? BRANCH_TYPE_ICONS[branch.branchType as BranchTypeValue]
                  : Building2;
                const TypeIcon = typeIcon;
                return <TypeIcon size={48} className="text-primary-gold" />;
              })()}
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0 pt-10">
          {branch.code && (
            <span className="inline-block px-2.5 py-1 rounded bg-gray-200 text-dark-charcoal/80 text-xs font-medium mb-2">
              {branch.code}
            </span>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-dark-charcoal">{branch.name}</h1>
          {branch.nameEn && <p className="text-sm text-dark-charcoal/60 mt-1">{branch.nameEn}</p>}
        </div>
        <div className="shrink-0 w-12" />
      </div>

      {/* Horizontal separator */}
      <div className="h-px bg-gradient-to-l from-transparent via-primary-gold/50 to-transparent mb-6" />

      {/* زر التعديل فوق التبويبات فقط (مثل أصحاب العمل) */}
      <div className="shrink-0 flex items-center gap-2 justify-end mb-4">
        <button
          type="button"
          onClick={() => setEditModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium"
        >
          <Pencil size={18} />
          {t('common.edit')}
        </button>
      </div>

      {/* التبويبات فقط (تحت زر التعديل) */}
      <TabsOrDropdown
        tabs={permittedTabs.map(tab => ({ ...tab, label: t(tab.labelKey), id: tab.id, icon: tab.icon, badge: tab.id === 'phones' && branchPhones.length > 0 ? branchPhones.length : undefined }))}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
        filter={(tab) => {
          const hideEntityTab = tab.id === 'entity' && (!branch.establishment || !(branch.establishment as { isEnabled?: number })?.isEnabled);
          const isOfficeOrWeb = isOfficeOrWebsite(branch.branchType);
          const hideForOfficeWeb = isOfficeOrWeb && tab.id === 'entity';
          return !hideEntityTab && !hideForOfficeWeb;
        }}
      />

      {/* Tab content - same format as Tax section */}
      <div className="bg-white rounded-lg border border-secondary-gray p-6">
        {activeTab === 'basic' && (
          <div className="space-y-6">
            {branch.linkedBranch && branchPerm.basic.linked && (
              <div className="pb-4 border-b border-secondary-gray/50">
                <p className="text-sm text-dark-charcoal/70">{t('branches.linkedToBranch')}</p>
                <p className="font-semibold text-primary-gold text-lg mt-1">{branch.linkedBranch.name}</p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 text-right">
              {branchPerm.basic.typeStatus && (
                <div>
                  <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('branches.viewBranchType')}</p>
                  <p className="font-medium text-dark-charcoal">{getBranchTypeLabel(branch.branchType, t)}</p>
                </div>
              )}
              {branchPerm.basic.location && (
                <>
                  <div>
                    <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('branches.viewEmirate')}</p>
                    <p className="font-medium text-dark-charcoal">{getEmirateLabel(branch.emirate, lang)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('branches.addModalCity')}</p>
                    <p className="font-medium text-dark-charcoal">{branch.city?.trim() ? branch.city : getEmirateLabel(branch.emirate, lang)}</p>
                  </div>
                </>
              )}
              {(branch.phone || (branchPerm.phones.list && branchPhones.length > 0)) && branchPerm.basic.contact && (
                <div className="md:col-span-2">
                  <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('branches.viewContactNumbers')}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {branch.phone && (
                      <span className="inline-flex items-center gap-1.5 bg-secondary-gray/10 text-dark-charcoal font-medium px-3 py-1 rounded" dir="ltr">
                        {branch.phone}
                      </span>
                    )}
                    {branchPerm.phones.list &&
                      branchPhones.map((bp) => (
                        <span key={bp.id} className="inline-flex items-center gap-1.5 bg-primary-gold/10 text-primary-gold font-medium px-3 py-1 rounded" dir="ltr">
                          {bp.numberType === 'landline' ? <Phone size={14} /> : <Smartphone size={14} />}
                          {bp.phoneNumber}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              {branchPerm.basic.tax && (branch.taxEntityTrn || branch.taxEntityCorporateTax) && (
                <div className="md:col-span-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {branch.taxEntityTrn && (
                    <span><span className="text-xs text-dark-charcoal/60 uppercase tracking-wide">TRN:</span> <span className="font-medium text-dark-charcoal">{branch.taxEntityTrn}</span></span>
                  )}
                  {branch.taxEntityCorporateTax && (
                    <span><span className="text-xs text-dark-charcoal/60 uppercase tracking-wide">CTRN:</span> <span className="font-medium text-dark-charcoal">{branch.taxEntityCorporateTax}</span></span>
                  )}
                </div>
              )}
            </div>
            {(branch.address || branch.linkedBranch?.address) && branchPerm.basic.address && (
              <div className="pt-2 border-t border-secondary-gray/30">
                <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5">{t('branches.viewAddress')}{branch.linkedBranch ? t('branches.addressLinkedBranch') : ''}</p>
                <p className="font-medium text-dark-charcoal">{branch.address || branch.linkedBranch?.address}</p>
              </div>
            )}
            {branch.googleMapUrl && branchPerm.basic.map && (
              <div className="pt-4 border-t border-secondary-gray/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide flex items-center gap-1">
                    <Globe size={14} /> {t('branches.branchMapLabel')}
                  </p>
                  <a
                    href={branch.googleMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary-gold hover:underline flex items-center gap-1"
                  >
                    {t('branches.openInBrowser')} <ArrowRight size={12} className="rotate-180" />
                  </a>
                </div>
                {/* @ts-ignore */}
                <webview src={branch.googleMapUrl} className="w-full h-80 rounded-lg overflow-hidden border border-secondary-gray" />
              </div>
            )}
            {branch.workTimingSlots && branchPerm.basic.schedule && (
              <div className="pt-4 border-t border-secondary-gray/30">
                <p className="text-xs text-dark-charcoal/60 uppercase tracking-wide mb-0.5 flex items-center gap-1"><Clock size={14} /> {t('branches.viewWorkHours')}</p>
                <p className="font-medium text-sm">
                  {(() => {
                    try {
                      if (branch.workTimingSlots.startsWith('{')) {
                        const s = JSON.parse(branch.workTimingSlots) as Record<string, { enabled?: boolean; slots?: { from: string; to: string }[] }>;
                        const labels: Record<string, string> = { sun: t('branches.daySun'), mon: t('branches.dayMon'), tue: t('branches.dayTue'), wed: t('branches.dayWed'), thu: t('branches.dayThu'), fri: t('branches.dayFri'), sat: t('branches.daySat') };
                        const dayOrder = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
                        return Object.entries(s)
                          .filter(([, v]) => v?.enabled && v?.slots?.length)
                          .sort(([a], [b]) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
                          .map(([k, v]) => `${labels[k] || k}: ${v!.slots!.map((x) => `${x.from}-${x.to}`).join('، ')}`)
                          .join(' | ') || '—';
                      }
                      return branch.workTimingSlots;
                    } catch { return branch.workTimingSlots; }
                  })()}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'licenses' && (
          <div className="space-y-6">
            {branch.linkedBranch && branchPerm.basic.linked && (
              <div className="border border-primary-gold/30 rounded-lg p-4 bg-primary-gold/5">
                <p className="font-medium text-dark-charcoal">{t('branches.linkedToBranch')} <span className="text-primary-gold">{branch.linkedBranch.name}</span></p>
              </div>
            )}
            {!branch.linkedBranch && branch.license && branchPerm.licenses.trade && (
              <div className="border border-secondary-gray rounded-lg p-4">
                <h4 className="text-primary-gold font-bold mb-4 pb-2 border-b">{t('branches.viewTradeLicense')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <div><label className="text-sm text-dark-charcoal/70">{t('branches.viewLicenseNo')}</label><p className="font-medium">{branch.license.licenseNo}</p></div>
                    {branchPerm.docs.tradeLicense && branchDocuments.some((d) => d.section === 'trade_license') && (
                      <button
                        type="button"
                        onClick={async () => {
                          const doc = branchDocuments.find((d) => d.section === 'trade_license');
                          if (doc && window.electronAPI?.documentGetUrl) {
                            const res = await window.electronAPI.documentGetUrl(doc.relativePath);
                            if (res?.success && res?.url) setDocPreview({ url: res.url, name: getDocumentDisplayName(doc.customName, doc.relativePath), relativePath: doc.relativePath });
                          }
                        }}
                        className="p-1.5 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10"
                        title={t('branches.preview')}
                      >
                        <Eye size={18} />
                      </button>
                    )}
                  </div>
                  {branch.license.tradeName && <div><label className="text-sm text-dark-charcoal/70">{t('branches.viewTradeName')}</label><p className="font-medium">{branch.license.tradeName}</p></div>}
                  {branch.license.issueDate && <div><label className="text-sm text-dark-charcoal/70">{t('branches.viewIssueDate')}</label><p className="font-medium">{branch.license.issueDate}</p></div>}
                  <div>
                    <label className="text-sm text-dark-charcoal/70">{t('branches.viewExpiryDate')}</label>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${getExpiryStatus(branch.license.expiryDate) === 'expired' ? 'text-red-600' : getExpiryStatus(branch.license.expiryDate) === 'warning' ? 'text-yellow-700' : 'text-dark-charcoal'}`}>
                        {branch.license.expiryDate || '—'}
                      </span>
                      {shouldShowUpdateButton(branch.license.expiryDate) && (
                        <button
                          onClick={() => setExpiryPopup({
                            config: { table: 'branch_licenses', column: 'expiryDate', recordId: branch.license!.id },
                            documentConfig: { entityType: 'branch', entityId: branchId, section: 'license_expiry' },
                            currentExpiry: branch.license!.expiryDate,
                            title: t('branches.updateLicenseExpiry'),
                            activityLogParams: { module: 'branch', action: 'expiry_update', entityType: 'branch', entityId: branchId, details: `expiryUpdate::license::{newDate}` }
                          })}
                          className="text-sm px-3 py-1 rounded bg-primary-gold text-white hover:bg-accent-sand"
                        >
                          {t('branches.leaseModalUpdate')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!branch.linkedBranch &&
              branch.lease &&
              (branchPerm.licenses.leaseMeta ||
                branchPerm.licenses.leaseTotal ||
                branchPerm.licenses.leaseSchedule ||
                branchPerm.licenses.leaseInstAmounts) && (
              <div className="border border-secondary-gray rounded-lg p-4">
                <h4 className="text-primary-gold font-bold mb-4 pb-2 border-b">{t('branches.viewLeaseContract')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {branchPerm.licenses.leaseMeta && (
                    <div className="flex items-center gap-2">
                      <div><label className="text-sm text-dark-charcoal/70">{t('branches.viewContractNo')}</label><p className="font-medium">{branch.lease.contractNo}</p></div>
                      {branchPerm.docs.lease && branchDocuments.some((d) => d.section === 'lease') && (
                        <button
                          type="button"
                          onClick={async () => {
                            const doc = branchDocuments.find((d) => d.section === 'lease');
                            if (doc && window.electronAPI?.documentGetUrl) {
                              const res = await window.electronAPI.documentGetUrl(doc.relativePath);
                              if (res?.success && res?.url) setDocPreview({ url: res.url, name: getDocumentDisplayName(doc.customName, doc.relativePath), relativePath: doc.relativePath });
                            }
                          }}
                          className="p-1.5 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10"
                          title={t('branches.preview')}
                        >
                          <Eye size={18} />
                        </button>
                      )}
                    </div>
                  )}
                  {branch.lease.landlordName && branchPerm.licenses.leaseMeta && <div><label className="text-sm text-dark-charcoal/70">{t('branches.viewLandlord')}</label><p className="font-medium">{branch.lease.landlordName}</p></div>}
                  {branch.lease.amount != null && branchPerm.licenses.leaseTotal && (
                    <div>
                      <label className="text-sm text-dark-charcoal/70">{t('branches.viewLeaseTotal')}</label>
                      <p className="font-medium">{Number(branch.lease.amount).toLocaleString('en')} {t('branches.leaseModalAed')}</p>
                    </div>
                  )}
                  {branchPerm.licenses.leaseMeta && (
                    <div>
                      <label className="text-sm text-dark-charcoal/70">{t('branches.viewLeaseExpiry')}</label>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-dark-charcoal">{branch.lease.expiryDate || '—'}</span>
                        {shouldShowUpdateButton(branch.lease.expiryDate) && (
                          <button
                            onClick={() => setLeaseExpiryModalOpen(true)}
                            className="text-sm px-3 py-1 rounded bg-primary-gold text-white hover:bg-accent-sand"
                          >
                            {t('branches.leaseModalUpdate')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {branch.leaseInstallments &&
                  branch.leaseInstallments.length > 0 &&
                  branchPerm.licenses.leaseSchedule && (
                  <div className="mt-4 pt-4 border-t border-secondary-gray/50">
                    <h5 className="text-sm font-semibold text-dark-charcoal mb-2">{t('branches.leaseModalInstallmentsTable')}</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="border-b border-secondary-gray/50">
                            <th className="py-2 px-3 text-sm font-medium text-dark-charcoal/80">#</th>
                            {branchPerm.licenses.leaseInstAmounts && (
                              <th className="py-2 px-3 text-sm font-medium text-dark-charcoal/80">
                                {t('branches.leaseModalAmount')}
                              </th>
                            )}
                            <th className="py-2 px-3 text-sm font-medium text-dark-charcoal/80">{t('branches.leaseModalDueDate')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branch.leaseInstallments.map((inst, idx) => {
                            const dueStr = inst.dueDate ? String(inst.dueDate).slice(0, 10) : '';
                            return (
                              <tr key={inst.id} className="border-b border-secondary-gray/30">
                                <td className="py-2 px-3 text-dark-charcoal">{idx + 1}</td>
                                {branchPerm.licenses.leaseInstAmounts && (
                                  <td className="py-2 px-3 text-dark-charcoal">
                                    {Number(inst.amount).toLocaleString('en')} {t('branches.leaseModalAed')}
                                  </td>
                                )}
                                <td className="py-2 px-3 text-dark-charcoal">{dueStr || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
            {branch.customFields && branch.customFields.length > 0 && branchPerm.licenses.custom && (
              <div className="space-y-4 mt-6">
                <h4 className="text-primary-gold font-bold pb-2 border-b">{t('branches.viewCustomSections')}</h4>
                {branch.customFields.map((field) => {
                  let rows: { key: string; value: string; isDate?: boolean; enableAlert?: boolean }[] = [];
                  try {
                    const parsed = field.content?.startsWith('{') ? JSON.parse(field.content) : null;
                    rows = parsed?.rows || (field.content ? [{ key: t('branches.content'), value: field.content }] : []);
                  } catch { rows = field.content ? [{ key: t('branches.content'), value: field.content }] : []; }
                  const alertRows = rows.filter((r) => r.enableAlert && r.isDate && r.value);
                  const primaryExpiryRow = alertRows.length === 0
                    ? null
                    : alertRows.reduce((a, b) => (new Date(b.value) > new Date(a.value) ? b : a));
                  // Show ALL rows (expired, today, future). Only dates with تنبيه affect badge color.
                  return (
                    <div key={field.id} className="border border-secondary-gray rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-dark-charcoal">{field.title}</h5>
                        {primaryExpiryRow && (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getExpiryBadgeClass(getExpiryStatus(primaryExpiryRow.value))}`}>
                            {getExpiryStatus(primaryExpiryRow.value) === 'expired' ? t('branches.expired') : getExpiryStatus(primaryExpiryRow.value) === 'warning' ? t('branches.warning') : t('branches.valid')}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {rows.map((r, i) => (
                          <div key={i} className="flex flex-col">
                            <span className="text-xs text-dark-charcoal/60">{r.key}</span>
                            <span className={`font-medium ${r.enableAlert && r.isDate ? (getExpiryStatus(r.value) === 'expired' ? 'text-red-600' : getExpiryStatus(r.value) === 'warning' ? 'text-yellow-700' : '') : ''}`}>
                              {r.value || '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!licensesTabShowsAnyBlock && (
              <p className="text-secondary-gray">
                {licensesTabHasNoDataAtAll ? t('branches.viewNoLicenses') : t('branches.noPermissionThisSection')}
              </p>
            )}
          </div>
        )}

        {activeTab === 'entity' && branch.establishment && (branch.establishment as { isEnabled?: number })?.isEnabled && (
          <div className="space-y-4">
            {!branchPerm.entity.info && !branchPerm.entity.emps && (
              <p className="text-secondary-gray">{t('branches.noPermissionThisSection')}</p>
            )}
            {(branchPerm.entity.info || branchPerm.entity.emps) && (
            <div className="flex gap-1 border-b border-secondary-gray mb-4">
              {branchPerm.entity.info && (
                <button
                  onClick={() => setEntitySubTab('entityInfo')}
                  className={`px-4 py-2 border-b-2 -mb-px font-medium transition-colors ${entitySubTab === 'entityInfo' ? 'border-primary-gold text-primary-gold' : 'border-transparent text-dark-charcoal/70 hover:text-dark-charcoal'}`}
                >
                  {t('branches.viewEntityInfo')}
                </button>
              )}
              {branchPerm.entity.emps && (
                <button
                  onClick={() => setEntitySubTab('entityEmployees')}
                  className={`px-4 py-2 border-b-2 -mb-px font-medium transition-colors ${entitySubTab === 'entityEmployees' ? 'border-primary-gold text-primary-gold' : 'border-transparent text-dark-charcoal/70 hover:text-dark-charcoal'}`}
                >
                  {t('branches.viewEntityEmployees')}
                </button>
              )}
            </div>
            )}
            {entitySubTab === 'entityInfo' && branchPerm.entity.info && (
              <div className="border border-secondary-gray rounded-lg p-4">
                <h4 className="text-primary-gold font-bold mb-4 pb-2 border-b">{t('branches.viewEstablishmentData')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(() => {
                    const est = branch.establishment as Record<string, unknown>;
                    const labor = est.laborEstablishmentCardNo;
                    return typeof labor === 'string' && labor.trim() !== '' ? (
                    <div><label className="text-sm text-dark-charcoal/70">{t('branches.viewLaborCard')}</label><p className="font-medium">{labor}</p></div>
                    ) : null;
                  })()}
                  {(() => {
                    const est = branch.establishment as Record<string, unknown>;
                    const imm = est.immigrationEstablishmentCardNo;
                    return typeof imm === 'string' && imm.trim() !== '' ? (
                    <div><label className="text-sm text-dark-charcoal/70">{t('branches.viewImmigrationCard')}</label><p className="font-medium">{imm}</p></div>
                    ) : null;
                  })()}
                  {(() => {
                    const exp = (branch.establishment as Record<string, unknown>).immigrationCardExpiryDate;
                    return typeof exp === 'string' && exp.trim() !== '' ? (
                    <div>
                      <label className="text-sm text-dark-charcoal/70">{t('branches.viewImmigrationExpiry')}</label>
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${getExpiryStatus(exp) === 'expired' ? 'text-red-600' : getExpiryStatus(exp) === 'warning' ? 'text-yellow-700' : ''}`}>
                          {exp}
                        </p>
                        {shouldShowUpdateButton(exp) && (
                          <button
                            onClick={() => setExpiryPopup({
                              config: { table: 'branch_establishments', column: 'immigrationCardExpiryDate', recordId: branchId, whereColumn: 'branchId' },
                              documentConfig: { entityType: 'branch', entityId: branchId, section: 'establishment_immigration_expiry' },
                              currentExpiry: exp,
                              title: t('branches.updateEstablishmentExpiry'),
                              activityLogParams: { module: 'branch', action: 'expiry_update', entityType: 'branch', entityId: branchId, details: `expiryUpdate::immigrationCard::{newDate}` }
                            })}
                            className="text-sm px-3 py-1 rounded bg-primary-gold text-white hover:bg-accent-sand"
                          >
                            {t('branches.leaseModalUpdate')}
                          </button>
                        )}
                      </div>
                    </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
            {entitySubTab === 'entityEmployees' && branchPerm.entity.emps && (
              establishmentEmployees.length === 0 ? (
                <p className="text-secondary-gray">{t('branches.viewNoEstablishmentEmployees')}</p>
              ) : (
                <div className="border border-secondary-gray rounded-lg overflow-hidden">
                  <table className="w-full text-right">
                    <thead className="bg-secondary-gray/20">
                      <tr>
                        <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewPhoto')}</th>
                        <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewName')}</th>
                        <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewContractType')}</th>
                        {showSalaryColumns && <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewSalary')}</th>}
                        <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewProfession')}</th>
                        <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewContractExpiry')}</th>
                        <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewResidenceExpiry')}</th>
                        <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewWorkStatus')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {establishmentEmployees.map((emp) => (
                        <tr key={emp.isSecondedToThis ? `loan-${emp.id}` : emp.id} className="border-t border-secondary-gray/50 hover:bg-secondary-gray/10 cursor-pointer" onClick={() => navigate(`/dashboard/employees/${emp.id}`)}>
                          <td className="p-3">
                            {emp.imagePath && window.electronAPI?.fileGetImageUrl ? (
                              <BranchEmployeeAvatar path={emp.imagePath} name={emp.name} />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-sm shrink-0">
                                {emp.name?.charAt(0) || '?'}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-medium">{emp.name}</td>
                          <td className="p-3 text-dark-charcoal/80">{emp.contractTypeLabel}</td>
                          {showSalaryColumns && <td className="p-3 text-dark-charcoal/80">{emp.totalSalary != null ? `${Number(emp.totalSalary).toLocaleString('en')} ${t('branches.leaseModalAed')}` : '—'}</td>}
                          <td className="p-3 text-dark-charcoal/80">{emp.professionPerContract}</td>
                          <td className="p-3 text-dark-charcoal/80">{emp.contractExpiryDate || '—'}</td>
                          <td className="p-3 text-dark-charcoal/80">{emp.emiratesIdExpiry || '—'}</td>
                          <td className="p-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getWorkStatusBadgeClass(emp.workStatusLabel)}`}>
                              {emp.workStatusLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryTab entityType="branch" entityId={branchId} />
        )}

        {activeTab === 'employees' && (
          !branchPerm.branchEmps.list ? (
            <p className="text-secondary-gray">{t('branches.noPermissionThisSection')}</p>
          ) : employees.length === 0 ? (
            <p className="text-secondary-gray">{t('branches.viewNoBranchEmployees')}</p>
          ) : (
            <div className="border border-secondary-gray rounded-lg overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-secondary-gray/20">
                  <tr>
                    <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewPhoto')}</th>
                    <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewName')}</th>
                    <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewProfession')}</th>
                    {showSalaryColumns && <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewActualSalary')}</th>}
                    <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewWorkStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const isOnLeave = emp.status === EmploymentStatus.LEAVE || (emp.status === EmploymentStatus.SECONDED && emp.loanType === LoanType.INTERNAL && emp.loanSubStatus === LoanSubStatus.LEAVE);
                    const statusLabel = isOnLeave ? t('branches.loanLeave') : t('branches.loanActive');
                    return (
                      <tr key={emp.id} className="border-t border-secondary-gray/50 hover:bg-secondary-gray/10 cursor-pointer" onClick={() => navigate(`/dashboard/employees/${emp.id}`)}>
                        <td className="p-3">
                          {emp.imagePath && window.electronAPI?.fileGetImageUrl ? (
                            <BranchEmployeeAvatar path={emp.imagePath} name={emp.name} />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-sm shrink-0">
                              {emp.name?.charAt(0) || '?'}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-medium">{emp.name}</td>
                        <td className="p-3 text-dark-charcoal/80">{emp.profession || emp.professionPerContract || '—'}</td>
                        {showSalaryColumns && <td className="p-3 text-dark-charcoal/80">{emp.actualSalary != null ? `${Number(emp.actualSalary).toLocaleString('en')} ${t('branches.leaseModalAed')}` : '—'}</td>}
                        <td className="p-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getWorkStatusBadgeClass(statusLabel)}`}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'employers' && (
          !branchPerm.employers.list ? (
            <p className="text-secondary-gray">{t('branches.noPermissionThisSection')}</p>
          ) : branchEmployers.length === 0 ? (
            <p className="text-secondary-gray">{t('branches.profileNoEmployers')}</p>
          ) : (
            <div className="border border-secondary-gray rounded-lg overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-secondary-gray/20">
                  <tr>
                    <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewName')}</th>
                    <th className="p-3 text-dark-charcoal font-medium">{t('branches.viewRole')}</th>
                    {branchPerm.employers.ownership && <th className="p-3 text-dark-charcoal font-medium">{t('branches.profileSharePercent')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {branchEmployers.map((emp) => (
                    <tr key={emp.id} className="border-t border-secondary-gray/50 hover:bg-secondary-gray/10 cursor-pointer" onClick={() => navigate(`/dashboard/employers/${emp.id}`)}>
                      <td className="p-3 font-medium">{emp.fullName}</td>
                      <td className="p-3 text-dark-charcoal/80">{emp.role === 'owner' ? t('branches.owner') : emp.role === 'partner' ? t('branches.partner') : emp.role === 'manager' ? t('branches.manager') : emp.role === 'agent' ? t('branches.agent') : emp.role}</td>
                      {branchPerm.employers.ownership && <td className="p-3 text-dark-charcoal/80">{emp.ownershipPercent != null ? `${emp.ownershipPercent}%` : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'documents' && (
          <div className="border border-secondary-gray rounded-lg p-6">
            <h4 className="text-primary-gold font-bold mb-4 pb-2 border-b">{t('branches.profileDocumentsTitle')}</h4>
            {branchDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="mx-auto text-secondary-gray mb-3" size={48} />
                <p className="text-dark-charcoal/70">{t('branches.noDocumentsHint')}</p>
              </div>
            ) : visibleDocuments.length === 0 ? (
              <p className="text-secondary-gray py-8 text-center">{t('branches.noPermissionThisSection')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {visibleDocuments.map((doc) => {
                  const name = getDocumentDisplayName(doc.customName, doc.relativePath);
                  const ext = name.split('.').pop()?.toLowerCase();
                  const isPdf = ext === 'pdf';
                  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
                  const icon = isPdf ? <FileText className="w-10 h-10 text-red-600" /> : isImg ? <ImageIcon className="w-10 h-10 text-green-600" /> : <File className="w-10 h-10 text-secondary-gray" />;
                  return (
                    <div key={doc.id} className="flex flex-col items-center p-4 rounded-lg border border-secondary-gray hover:border-primary-gold/50">
                      {icon}
                      <span className="text-sm font-medium text-dark-charcoal mt-2 text-center truncate w-full">{name}</span>
                      <div className="flex gap-1 mt-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await window.electronAPI?.documentGetUrl?.(doc.relativePath);
                            if (res?.success && res?.url) setDocPreview({ url: res.url, name });
                          }}
                          className="p-2 rounded-lg hover:bg-secondary-gray/30"
                          title={t('branches.preview')}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => window.electronAPI?.documentOpenExternal?.(doc.relativePath)}
                          className="p-2 rounded-lg hover:bg-secondary-gray/30"
                          title={t('branches.downloadOpen')}
                        >
                          <Download size={16} />
                        </button>
                        {canDeleteBranchDocs && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(t('branches.confirmDeleteDoc', { name }))) return;
                              const res = await window.electronAPI?.documentDelete?.(doc.id);
                              if (res?.success) loadBranchDetails();
                            }}
                            className="p-2 rounded-lg hover:bg-alert-red/10 text-alert-red"
                            title={t('branches.deleteDocument')}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(activeTab as string) === 'phones' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-secondary-gray/50">
              <h4 className="font-bold text-lg text-primary-gold">{t('branches.profilePhonesTitle')}</h4>
            </div>
            {!branchPerm.phones.list ? (
              <p className="text-secondary-gray py-8 text-center text-lg">{t('branches.noPermissionThisSection')}</p>
            ) : branchPhones.length === 0 ? (
              <p className="text-secondary-gray py-8 text-center text-lg">{t('branches.profileNoPhones')}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {branchPhones.map((p) => (
                  <div key={p.id} onClick={() => navigate(`/dashboard/phones/${p.id}`)} className="border border-secondary-gray/30 p-4 rounded-lg flex items-center justify-between hover:border-primary-gold/50 transition-colors cursor-pointer bg-light-background">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary-gray/20 flex items-center justify-center shrink-0 text-primary-gold">
                        {p.numberType === 'landline' ? <Phone size={20} /> : <Smartphone size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-dark-charcoal text-lg" dir="ltr">{p.phoneNumber}</p>
                        <p className="text-sm text-secondary-gray mt-1">{p.provider === 'etisalat' ? t('branches.etisalat') : p.provider === 'du' ? t('branches.du') : p.provider} - {p.category === 'prepaid' ? t('branches.prepaid') : t('branches.invoice')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* أزرار الحذف والأرشفة أسفل الصفحة (مثل أصحاب العمل) */}
      <div className="mt-8 pt-6 border-t border-secondary-gray flex gap-3 justify-end">
        <button
          onClick={handleArchiveClick}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/50 text-amber-700 hover:bg-amber-50 transition-colors"
        >
          <Archive size={18} />
          {t('common.archive')}
        </button>
        <button
          onClick={handleDeleteClick}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/50 text-red-700 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={18} />
          {t('common.delete')}
        </button>
      </div>

      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setArchiveConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl modal-box-mobile" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <Archive size={28} />
              <h3 className="font-bold text-lg">{t('branchProfile.confirmArchiveTitle')}</h3>
            </div>
            <p className="text-dark-charcoal mb-4">{t('branchProfile.confirmArchiveMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setArchiveConfirm(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('common.cancel')}</button>
              <button onClick={handleArchive} className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('branchProfile.confirmArchiveButton')}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl modal-box-mobile" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Trash2 size={28} />
              <h3 className="font-bold text-lg">{t('branchProfile.confirmDeleteTitle')}</h3>
            </div>
            <p className="text-dark-charcoal mb-4">{t('branches.confirmDeleteBranch')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('common.cancel')}</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">{t('branchProfile.confirmDeleteButton')}</button>
            </div>
          </div>
        </div>
      )}

      {/* تحذير: لا يمكن الأرشفة/الحذف بسبب وجود موظفين مرتبطين */}
      {linkedEmployeesCount != null && linkedEmployeesCount > 0 && blockReason && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setLinkedEmployeesCount(null); setBlockReason(null); }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl modal-box-mobile" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle size={28} />
              <h3 className="font-bold text-lg">
                {blockReason === 'archive' ? t('branches.cannotArchive') : t('branches.cannotDelete')}
              </h3>
            </div>
            <p className="text-dark-charcoal mb-4">
              {t('branches.cannotArchiveDeleteReason', { action: blockReason === 'archive' ? t('branches.archiveAction') : t('branches.deleteAction'), count: linkedEmployeesCount })}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => { setLinkedEmployeesCount(null); setBlockReason(null); }}
                className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-amber-600"
              >
                {t('common.ok')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddBranchModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => { setEditModalOpen(false); loadBranchDetails(); }}
        editBranchId={branchId}
      />

      {leaseExpiryModalOpen && branch?.lease && (
        <UpdateLeaseExpiryModal
          isOpen
          onClose={() => setLeaseExpiryModalOpen(false)}
          onSaved={() => { setLeaseExpiryModalOpen(false); loadBranchDetails(); }}
          leaseId={branch.lease.id}
          branchId={branchId}
          branchName={branch.name}
          currentExpiry={branch.lease.expiryDate || ''}
          installments={(branch.leaseInstallments ?? []).map((i) => ({ id: i.id, seq: i.seq, amount: i.amount, dueDate: i.dueDate, note: i.note }))}
        />
      )}

      {expiryPopup && (
        <UpdateExpiryPopup
          isOpen
          onClose={() => setExpiryPopup(null)}
          onSaved={handleExpirySaved}
          config={expiryPopup.config}
          documentConfig={expiryPopup.documentConfig}
          currentExpiry={expiryPopup.currentExpiry}
          title={expiryPopup.title}
          activityLogParams={expiryPopup.activityLogParams}
        />
      )}

      <DocumentPreviewModal
        preview={docPreview}
        onClose={() => setDocPreview(null)}
        onOpenExternal={async (relativePath) => {
          if (relativePath) await window.electronAPI?.documentOpenExternal?.(relativePath);
        }}
      />
    </div>
  );
}
