import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Building2,
  MapPin,
  Phone,
  FileText,
  Users,
  FolderOpen,
  Clock,
  Landmark,
  Pencil,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UpdateExpiryPopup, { type UpdateExpiryConfig, type DocumentLinkConfig } from '../shared/UpdateExpiryPopup';
import { ContractType, EmploymentStatus, LoanType, LoanSubStatus } from '../../constants/employee';
import { getWorkStatusBadgeClass } from '../../utils/workStatusBadge';
import {
  getBranchById,
  getBranchCustomFields,
  getBranchEmployeesForProfile,
  getBranchEstablishment,
  getBranchEstablishmentPrimaryEmployees,
  getBranchLease,
  getBranchLeaseInstallments,
  getBranchLicense,
  getBranchSecondedEmployees,
} from '../../services/branchService';
import { usePermissions } from '../../hooks/usePermissions';
import { canEmployeesFieldView } from '../../services/permissionsService';
import {
  canBranchUiTab,
  canBranchFieldInTab,
  type BranchProfileTabId,
} from '../../services/branchPermissions';

function useLoanSubLabels(t: (k: string) => string): Record<string, string> {
  return {
    [LoanSubStatus.ACTIVE]: t('branches.loanActive'),
    [LoanSubStatus.LEAVE]: t('branches.loanLeave'),
    [LoanSubStatus.INACTIVE]: t('branches.loanInactive'),
  };
}

const TAB_IDS = [
  { id: 'basic' as const, labelKey: 'branches.profileTabBasic', icon: Building2 },
  { id: 'licenses' as const, labelKey: 'branches.profileTabLicenses', icon: FileText },
  { id: 'entity' as const, labelKey: 'branches.profileTabEntity', icon: Landmark },
  { id: 'employees' as const, labelKey: 'branches.profileTabEmployees', icon: Users },
  { id: 'documents' as const, labelKey: 'branches.profileTabDocuments', icon: FolderOpen },
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

function ViewBranchEmployeeAvatar({ path, name }: { path: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!path || !window.electronAPI?.fileGetImageUrl) return;
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

interface ViewBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: number;
  onRefresh?: () => void;
  onEdit?: (branchId: number) => void;
}

interface BranchDetails {
  id: number;
  name: string;
  nameEn?: string;
  emirate: string;
  address?: string;
  phone?: string;
  photoPath?: string;
  branchType: string;
  status: string;
  country: string;
  workHours?: string;
  workTimingSlots?: string;
  createdAt?: string;
  updatedAt?: string;
  license?: {
    id: number;
    licenseNo: string;
    tradeName?: string;
    issueDate?: string;
    expiryDate?: string;
  };
  lease?: {
    id: number;
    contractNo: string;
    landlordName?: string;
    amount?: number;
    issueDate?: string;
    expiryDate?: string;
  };
  leaseInstallments?: { id: number; seq: number; amount: number; dueDate?: string; note?: string }[];
  establishment?: {
    isEnabled?: boolean;
    laborEstablishmentCardNo?: string;
    immigrationEstablishmentCardNo?: string;
    immigrationCardIssueDate?: string;
    immigrationCardExpiryDate?: string;
    trn?: string;
    corporateTaxRegistration?: string;
  };
  customFields?: Array<{
    id: number;
    title: string;
    content?: string;
    enableAlert: boolean;
    alertDate?: string;
    daysBeforeExpiry?: number;
  }>;
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

interface EstablishmentEmployee {
  id: number;
  name: string;
  imagePath?: string;
  isSecondedToThis: boolean;
  contractTypeLabel: string;
  totalSalary?: number;
  professionPerContract: string;
  contractExpiryDate?: string;
  emiratesIdExpiry?: string;
  workStatusLabel: string;
}

export default function ViewBranchModal({
  isOpen,
  onClose,
  branchId,
  onRefresh,
  onEdit,
}: ViewBranchModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
        schedule: f('basic', 'field.workSchedule.view'),
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
    };
  }, [granularFieldBypass, permissions]);

  const showSalaryColumns = useMemo(
    () =>
      granularFieldBypass ||
      (canBranchFieldInTab(permissions, 'employees', 'field.showSalariesInBranchEmployeeTab.view') &&
        canEmployeesFieldView(permissions, 'field.actualSalary.view')),
    [granularFieldBypass, permissions]
  );

  const LOAN_SUB_LABELS = useLoanSubLabels(t);
  const [branch, setBranch] = useState<BranchDetails | null>(null);

  const permittedTabs = useMemo(() => {
    if (!branch) return TAB_IDS;
    return TAB_IDS.filter((tab) => {
      const hideEntity =
        tab.id === 'entity' &&
        (!branch.establishment || !(branch.establishment as { isEnabled?: number })?.isEnabled);
      if (hideEntity) return false;
      return canBranchUiTab(permissions, tab.id);
    });
  }, [branch, permissions]);

  const licensesModalShowsAnyBlock = useMemo(() => {
    if (!branch) return true;
    const hasTrade = !!(branch.license && branchPerm.licenses.trade);
    const hasLease = !!(
      branch.lease &&
      (branchPerm.licenses.leaseMeta ||
        branchPerm.licenses.leaseTotal ||
        branchPerm.licenses.leaseSchedule ||
        branchPerm.licenses.leaseInstAmounts)
    );
    const hasCustom = !!(branch.customFields?.length && branchPerm.licenses.custom);
    return hasTrade || hasLease || hasCustom;
  }, [branch, branchPerm]);

  const licensesModalHasNoDataAtAll = useMemo(
    () => !!branch && !branch.license && !branch.lease && !(branch.customFields?.length),
    [branch]
  );
  const [employees, setEmployees] = useState<BranchEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [expiryPopup, setExpiryPopup] = useState<{ config: UpdateExpiryConfig; documentConfig?: DocumentLinkConfig; currentExpiry?: string; title: string; activityLogParams?: { module: string; action: string; entityType: string; entityId?: number; details: string } } | null>(null);
  const [establishmentEmployees, setEstablishmentEmployees] = useState<EstablishmentEmployee[]>([]);
  const [entitySubTab, setEntitySubTab] = useState<'entityInfo' | 'entityEmployees'>('entityInfo');

  const loadBranchDetails = async () => {
    if (!window.electronAPI?.dbQuery) return;
    setLoading(true);
    try {
      const branchResult = await getBranchById(branchId);
      const brRows = branchResult?.data as Record<string, unknown>[] | undefined;
      if (!branchResult?.success || !brRows?.[0]) {
        setBranch(null);
        setLoading(false);
        return;
      }
      const branchData = brRows[0] as unknown as BranchDetails;

      const [licenseResult, leaseResult, instResult, establishmentResult, customFieldsResult, empResult] =
        await Promise.all([
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
        ]);

      const licRows = licenseResult?.data as BranchDetails['license'][] | undefined;
      const leaseRows = leaseResult?.data as BranchDetails['lease'][] | undefined;
      const instRows = instResult?.data as NonNullable<BranchDetails['leaseInstallments']> | undefined;
      const estRows = establishmentResult?.data as BranchDetails['establishment'][] | undefined;
      setBranch({
        ...branchData,
        license: licenseResult?.success && licRows?.[0] ? licRows[0] : undefined,
        lease: leaseResult?.success && leaseRows?.[0] ? leaseRows[0] : undefined,
        leaseInstallments: instResult?.success && Array.isArray(instRows) ? instRows : [],
        establishment: establishmentResult?.success && estRows?.[0] ? estRows[0] : undefined,
        customFields:
          customFieldsResult?.success && Array.isArray(customFieldsResult.data)
            ? customFieldsResult.data
            : [],
      });
      setEmployees((empResult?.data as BranchEmployee[] | undefined) ?? []);

      const estData = establishmentResult?.success && estRows?.[0] ? estRows[0] : null;
      const estEnabled = estData?.isEnabled;
      let estEmps: EstablishmentEmployee[] = [];
      if (estEnabled) {
        const [primaryRes, secondedRes] = await Promise.all([
          getBranchEstablishmentPrimaryEmployees(branchId),
          getBranchSecondedEmployees(branchId, EmploymentStatus.SECONDED, LoanType.INTERNAL),
        ]);
        const primary = ((primaryRes?.data ?? []) as Record<string, unknown>[]).map((e) => {
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
        const seconded = ((secondedRes?.data ?? []) as Record<string, unknown>[]).map((e) => {
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

      if (branchData.photoPath && window.electronAPI.fileGetImageUrl) {
        const imgRes = await window.electronAPI.fileGetImageUrl(branchData.photoPath);
        if (imgRes.success && imgRes.url) setImageUrl(imgRes.url);
      } else {
        setImageUrl(null);
      }
    } catch (e) {
      console.error(e);
      setBranch(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && branchId) loadBranchDetails();
  }, [isOpen, branchId]);

  const handleExpirySaved = () => {
    setExpiryPopup(null);
    loadBranchDetails();
    onRefresh?.();
  };

  useEffect(() => {
    if (!branch) return;
    if (entitySubTab === 'entityInfo' && !branchPerm.entity.info && branchPerm.entity.emps) setEntitySubTab('entityEmployees');
    if (entitySubTab === 'entityEmployees' && !branchPerm.entity.emps && branchPerm.entity.info) setEntitySubTab('entityInfo');
  }, [branch, branchPerm.entity.info, branchPerm.entity.emps, entitySubTab]);

  useEffect(() => {
    if (!branch) return;
    if (!permittedTabs.some((t) => t.id === activeTab)) setActiveTab(permittedTabs[0]?.id ?? 'basic');
  }, [branch, permittedTabs, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {loading ? (
          <div className="p-12 text-center text-secondary-gray">{t('common.loading')}</div>
        ) : !branch ? (
          <div className="p-12 text-center text-red-600">{t('branches.viewLoadError')}</div>
        ) : (
          <>
            {/* Identity Card Header */}
            <div className="bg-white px-6 py-6 shrink-0 border-b border-secondary-gray/30">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {imageUrl && branchPerm.basic.photo ? (
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary-gold/30 shrink-0">
                    <img src={imageUrl} alt={branch.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-secondary-gray/30 flex items-center justify-center shrink-0 border-4 border-primary-gold/20">
                    <Building2 className="text-secondary-gray" size={40} />
                  </div>
                )}
                <div className="flex-1 text-center sm:text-right min-w-0">
                  <h2 className="text-2xl font-bold text-dark-charcoal">{branch.name}</h2>
                  {branch.nameEn && (
                    <p className="text-sm text-dark-charcoal/60 mt-0.5">{branch.nameEn}</p>
                  )}
                  <span
                    className={`inline-flex items-center mt-3 px-4 py-1.5 rounded-full text-sm font-bold ${
                      computeLiveStatus(branch.workTimingSlots, branch.status) === 'Open'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {computeLiveStatus(branch.workTimingSlots, branch.status) === 'Open' ? t('branches.open') : t('branches.closed')}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => { onEdit(branchId); onClose(); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand transition-colors text-sm font-medium"
                    >
                      <Pencil size={16} />
                      {t('common.edit')}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-dark-charcoal hover:bg-secondary-gray/30 transition-colors"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>
              <div className="mt-4 h-px bg-gradient-to-l from-transparent via-primary-gold/50 to-transparent" />
            </div>

            {/* Tabs */}
            <div className="border-b border-secondary-gray bg-white px-6 shrink-0">
              <div className="flex gap-1 overflow-x-auto">
                {permittedTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === tab.id
                          ? 'border-primary-gold text-primary-gold font-medium'
                          : 'border-transparent text-dark-charcoal/70 hover:text-dark-charcoal'
                      }`}
                    >
                      <Icon size={18} />
                      {t(tab.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab content - white background */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {branchPerm.basic.location && (
                    <div>
                      <label className="text-sm text-dark-charcoal/70 flex items-center gap-1">
                        <MapPin size={14} /> {t('branches.viewEmirate')}
                      </label>
                      <p className="font-medium text-dark-charcoal">{branch.emirate}</p>
                    </div>
                    )}
                    {branch.address && branchPerm.basic.address && (
                      <div className="md:col-span-2">
                        <label className="text-sm text-dark-charcoal/70">{t('branches.viewAddress')}</label>
                        <p className="font-medium text-dark-charcoal">{branch.address}</p>
                      </div>
                    )}
                    {branch.phone && branchPerm.basic.contact && (
                      <div>
                        <label className="text-sm text-dark-charcoal/70 flex items-center gap-1">
                          <Phone size={14} /> {t('branches.viewPhoneNumber')}
                        </label>
                        <p className="font-medium text-dark-charcoal">{branch.phone}</p>
                      </div>
                    )}
                    {branch.workTimingSlots && branchPerm.basic.schedule && (
                      <div className="md:col-span-2">
                        <label className="text-sm text-dark-charcoal/70 flex items-center gap-1">
                          <Clock size={14} /> {t('branches.viewWorkHours')}
                        </label>
                        <p className="font-medium text-dark-charcoal text-sm">
                          {(() => {
                            try {
                              if (branch.workTimingSlots!.startsWith('{')) {
                                const s = JSON.parse(branch.workTimingSlots!) as Record<string, { enabled?: boolean; slots?: { from: string; to: string }[] }>;
                                const labels: Record<string, string> = { sun: t('branches.daySun'), mon: t('branches.dayMon'), tue: t('branches.dayTue'), wed: t('branches.dayWed'), thu: t('branches.dayThu'), fri: t('branches.dayFri'), sat: t('branches.daySat') };
                                const dayOrder = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
                                return Object.entries(s)
                                  .filter(([, v]) => v?.enabled && v?.slots?.length)
                                  .sort(([a], [b]) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
                                  .map(([k, v]) => `${labels[k] || k}: ${v!.slots!.map((x) => `${x.from}-${x.to}`).join('، ')}`)
                                  .join(' | ') || '—';
                              }
                              return branch.workTimingSlots;
                            } catch {
                              return branch.workTimingSlots;
                            }
                          })()}
                        </p>
                      </div>
                    )}
                    {branchPerm.basic.typeStatus && (
                    <div>
                      <label className="text-sm text-dark-charcoal/70">{t('branches.viewBranchType')}</label>
                      <p className="font-medium text-dark-charcoal">
                        {branch.branchType === 'store'
                          ? t('branches.store')
                          : branch.branchType === 'workshop'
                            ? t('branches.workshop')
                            : branch.branchType === 'office'
                              ? t('branches.office')
                              : t('branches.warehouse')}
                      </p>
                    </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'licenses' && (
                <div className="space-y-6">
                  {branch.license && branchPerm.licenses.trade && (
                    <div className="border border-secondary-gray rounded-lg p-4">
                      <h4 className="text-primary-gold font-bold mb-4 pb-2 border-b border-secondary-gray">
                        {t('branches.viewTradeLicense')}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm text-dark-charcoal/70">{t('branches.viewLicenseNo')}</label>
                          <p className="font-medium">{branch.license.licenseNo}</p>
                        </div>
                        {branch.license.tradeName && (
                          <div>
                            <label className="text-sm text-dark-charcoal/70">{t('branches.viewTradeName')}</label>
                            <p className="font-medium">{branch.license.tradeName}</p>
                          </div>
                        )}
                        {branch.license.issueDate && (
                          <div>
                            <label className="text-sm text-dark-charcoal/70">{t('branches.viewIssueDate')}</label>
                            <p className="font-medium">{branch.license.issueDate}</p>
                          </div>
                        )}
                        <div>
                          <label className="text-sm text-dark-charcoal/70">{t('branches.viewExpiryDate')}</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className={`font-medium ${
                                isExpired(branch.license.expiryDate)
                                  ? 'text-red-600'
                                  : 'text-dark-charcoal'
                              }`}
                            >
                              {branch.license.expiryDate || '—'}
                            </p>
                            {shouldShowUpdateButton(branch.license.expiryDate) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpiryPopup({
                                    config: { table: 'branch_licenses', column: 'expiryDate', recordId: branch.license!.id },
                                    documentConfig: { entityType: 'branch', entityId: branchId, section: 'license_expiry' },
                                    currentExpiry: branch.license!.expiryDate,
                                    title: t('branches.updateLicenseExpiry'),
                                    activityLogParams: { module: 'branch', action: 'expiry_update', entityType: 'branch', entityId: branchId, details: `expiryUpdate::license::{newDate}` },
                                  })
                                }
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
                  {branch.lease &&
                    (branchPerm.licenses.leaseMeta ||
                      branchPerm.licenses.leaseTotal ||
                      branchPerm.licenses.leaseSchedule ||
                      branchPerm.licenses.leaseInstAmounts) && (
                    <div className="border border-secondary-gray rounded-lg p-4">
                      <h4 className="text-primary-gold font-bold mb-4 pb-2 border-b border-secondary-gray">
                        {t('branches.viewLeaseContract')}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {branchPerm.licenses.leaseMeta && (
                        <div>
                          <label className="text-sm text-dark-charcoal/70">{t('branches.viewContractNo')}</label>
                          <p className="font-medium">{branch.lease.contractNo}</p>
                        </div>
                        )}
                        {branch.lease.landlordName && branchPerm.licenses.leaseMeta && (
                          <div>
                            <label className="text-sm text-dark-charcoal/70">{t('branches.viewLandlord')}</label>
                            <p className="font-medium">{branch.lease.landlordName}</p>
                          </div>
                        )}
                        {branch.lease.amount != null && branchPerm.licenses.leaseTotal && (
                          <div>
                            <label className="text-sm text-dark-charcoal/70">{t('branches.viewRentValue')}</label>
                            <p className="font-medium">
                              {Number(branch.lease.amount).toLocaleString('en')} {t('branches.leaseModalAed')}
                            </p>
                          </div>
                        )}
                        {branchPerm.licenses.leaseMeta && (
                        <div>
                          <label className="text-sm text-dark-charcoal/70">{t('branches.viewLeaseExpiry')}</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className={`font-medium ${
                                isExpired(branch.lease.expiryDate)
                                  ? 'text-red-600'
                                  : 'text-dark-charcoal'
                              }`}
                            >
                              {branch.lease.expiryDate || '—'}
                            </p>
                            {shouldShowUpdateButton(branch.lease.expiryDate) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpiryPopup({
                                    config: { table: 'branch_leases', column: 'expiryDate', recordId: branch.lease!.id },
                                    documentConfig: { entityType: 'branch', entityId: branchId, section: 'lease_expiry' },
                                    currentExpiry: branch.lease!.expiryDate,
                                    title: t('branches.leaseModalTitle'),
                                    activityLogParams: { module: 'branch', action: 'expiry_update', entityType: 'branch', entityId: branchId, details: `expiryUpdate::lease::{newDate}` },
                                  })
                                }
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
                          <h5 className="text-sm font-semibold text-dark-charcoal mb-2">
                            {t('branches.leaseModalInstallmentsTable')}
                          </h5>
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
                                  <th className="py-2 px-3 text-sm font-medium text-dark-charcoal/80">
                                    {t('branches.leaseModalDueDate')}
                                  </th>
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
                      <h4 className="text-primary-gold font-bold pb-2 border-b border-secondary-gray">
                        {t('branches.viewCustomSections')}
                      </h4>
                      {branch.customFields.map((field) => {
                        let rows: { key: string; value: string; isDate?: boolean; enableAlert?: boolean }[] = [];
                        try {
                          const parsed = field.content?.startsWith('{') ? JSON.parse(field.content) : null;
                          rows = parsed?.rows || (field.content ? [{ key: t('branches.content'), value: field.content }] : []);
                        } catch {
                          rows = field.content ? [{ key: t('branches.content'), value: field.content }] : [];
                        }
                        return (
                          <div key={field.id} className="border border-secondary-gray rounded-lg p-4">
                            <h5 className="font-semibold text-dark-charcoal mb-3">{field.title}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {rows.map((r, i) => (
                                <div key={i} className="flex flex-col">
                                  <span className="text-xs text-dark-charcoal/60">{r.key}</span>
                                  <span className={`font-medium ${r.isDate && isExpired(r.value) ? 'text-red-600' : ''}`}>
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
                  {!licensesModalShowsAnyBlock && (
                    <p className="text-secondary-gray">
                      {licensesModalHasNoDataAtAll ? t('branches.viewNoLicenses') : t('branches.noPermissionThisSection')}
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
                      <h4 className="text-primary-gold font-bold mb-4 pb-2 border-b border-secondary-gray">
                        {t('branches.viewEstablishmentData')}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {branch.establishment.laborEstablishmentCardNo && (
                          <div>
                            <label className="text-sm text-dark-charcoal/70">{t('branches.viewLaborCard')}</label>
                            <p className="font-medium">{branch.establishment.laborEstablishmentCardNo}</p>
                          </div>
                        )}
                        {branch.establishment.immigrationEstablishmentCardNo && (
                          <div>
                            <label className="text-sm text-dark-charcoal/70">{t('branches.viewImmigrationCard')}</label>
                            <p className="font-medium">{branch.establishment.immigrationEstablishmentCardNo}</p>
                          </div>
                        )}
                        {branch.establishment.trn && (
                          <div>
                            <label className="text-sm text-dark-charcoal/70">TRN</label>
                            <p className="font-medium">{branch.establishment.trn}</p>
                          </div>
                        )}
                        {branch.establishment.corporateTaxRegistration && (
                          <div>
                            <label className="text-sm text-dark-charcoal/70">{t('branches.viewTaxReg')}</label>
                            <p className="font-medium">{branch.establishment.corporateTaxRegistration}</p>
                          </div>
                        )}
                        {branch.establishment.immigrationCardExpiryDate && (
                          <div>
                            <label className="text-sm text-dark-charcoal/70">{t('branches.viewImmigrationExpiry')}</label>
                            <p className={`font-medium ${isExpired(branch.establishment.immigrationCardExpiryDate) ? 'text-red-600' : ''}`}>
                              {branch.establishment.immigrationCardExpiryDate}
                            </p>
                          </div>
                        )}
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
                              <tr
                                key={emp.isSecondedToThis ? `loan-${emp.id}` : emp.id}
                                className="border-t border-secondary-gray/50 hover:bg-secondary-gray/10 cursor-pointer"
                                onClick={() => {
                                  onClose();
                                  navigate(`/dashboard/employees/${emp.id}`);
                                }}
                              >
                                <td className="p-3">
                                  {emp.imagePath && window.electronAPI?.fileGetImageUrl ? (
                                    <ViewBranchEmployeeAvatar path={emp.imagePath} name={emp.name} />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-sm shrink-0">
                                      {emp.name?.charAt(0) || '?'}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 font-medium text-dark-charcoal">{emp.name}</td>
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

              {activeTab === 'employees' && (
                <div>
                  {!branchPerm.branchEmps.list ? (
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
                            const isWorking = emp.status === EmploymentStatus.ACTIVE || emp.status === EmploymentStatus.LEAVE || (emp.status === EmploymentStatus.SECONDED && emp.loanType === LoanType.INTERNAL && emp.loanSubStatus === LoanSubStatus.ACTIVE);
                            const statusLabel = isOnLeave ? t('branches.loanLeave') : isWorking ? t('branches.loanActive') : t('branches.loanInactive');
                            return (
                              <tr
                                key={emp.id}
                                className="border-t border-secondary-gray/50 hover:bg-secondary-gray/10 cursor-pointer"
                                onClick={() => {
                                  onClose();
                                  navigate(`/dashboard/employees/${emp.id}`);
                                }}
                              >
                                <td className="p-3">
                                  {emp.imagePath && window.electronAPI?.fileGetImageUrl ? (
                                    <ViewBranchEmployeeAvatar path={emp.imagePath} name={emp.name} />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-sm shrink-0">
                                      {emp.name?.charAt(0) || '?'}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 font-medium text-dark-charcoal">{emp.name}</td>
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
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="border border-secondary-gray rounded-lg p-8 text-center">
                  <FolderOpen className="mx-auto text-secondary-gray mb-3" size={48} />
                  <p className="text-dark-charcoal/70 font-medium">{t('nav.documents')}</p>
                  <p className="text-sm text-dark-charcoal/50 mt-1">
                    {t('branches.viewDocumentsComingSoon')}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="border-t border-secondary-gray p-4 bg-white shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-dark-charcoal text-white hover:bg-secondary-gray transition-colors"
          >
            {t('nav.close')}
          </button>
        </div>
      </div>

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
    </div>
  );
}
