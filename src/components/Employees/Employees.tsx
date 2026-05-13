import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Plus, User, Store, ChevronLeft, RefreshCw, CheckCircle, AlertTriangle, AlertCircle, Building2, Globe, Filter } from 'lucide-react';
import AddEmployeeModal from './AddEmployeeModal';
import { getExpiryStatus } from '../../utils/expiryAlert';
import { getWorkStatusBadgeClass } from '../../utils/workStatusBadge';
import { EmploymentStatus, LoanType, LoanSubStatus } from '../../constants/employee';
import { ViewModeToggle } from '../shared/ViewModeToggle';
import { BRANCH_TYPES, type BranchTypeValue } from '../../constants/branchTypes';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { usePermissions } from '../../hooks/usePermissions';
import type { PermissionEntry } from '../../services/permissionsService';
import { canEmployeesFieldView } from '../../services/permissionsService';
import { useExpiryUiSettings } from '../../hooks/useExpiryUiSettings';
import WorkshopIcon from '../Icons/WorkshopIcon';
import { PROFESSION_ICON_MAP } from '../Icons/ProfessionIcons';
import { EntityAvatar } from '../shared/EntityAvatar';
import { dbQuery } from '../../services/dbClient';

const BRANCH_TYPE_ICONS: Record<string, typeof Store | typeof WorkshopIcon | typeof Building2 | typeof Globe> = {
  store: Store,
  workshop: WorkshopIcon,
  office: Building2,
  website: Globe,
};

const LOAN_SUB_KEYS: Record<string, string> = {
  active: 'employees.loanActive',
  leave: 'employees.loanLeave',
  inactive: 'employees.loanInactive',
};

const WORK_STATUS_KEYS: Record<string, string> = {
  [EmploymentStatus.ACTIVE]: 'employees.statusActive',
  [EmploymentStatus.LEAVE]: 'employees.statusLeave',
  [EmploymentStatus.SUSPENDED]: 'employees.statusSuspended',
  [EmploymentStatus.SECONDED]: 'employees.statusSeconded',
  [EmploymentStatus.INACTIVE]: 'employees.statusInactive',
  [EmploymentStatus.VISA_CANCELLED]: 'employees.statusVisaCancelled',
  [EmploymentStatus.TERMINATED]: 'employees.statusTerminated',
};

/** خيارات فلترة الموظفين: المنشأة، فرع العمل، الوظيفة (يمكن إضافة المزيد لاحقاً مثل تاريخ انتهاء) */
type EmployeeFilterBy = '' | 'establishment' | 'branch' | 'profession';

interface FilterOption {
  id: string;
  label: string;
}

function normalizeProfessionForFilter(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const idx = raw.indexOf(':');
  return (idx >= 0 ? raw.slice(0, idx) : raw).trim();
}

interface EmployeeRow {
  id: number;
  code?: string;
  name: string;
  phone?: string;
  profession?: string;
  professionPerContract?: string;
  professionKeys?: string | null;
  status: string;
  loanType?: string;
  loanSubStatus?: string;
  workBranchId?: number;
  workBranchName?: string;
  workBranchTradeName?: string;
  workBranchType?: string;
  passportExpiry?: string;
  emiratesIdExpiry?: string;
  workCardExpiry?: string;
  contractExpiryDate?: string;
  loanExpiryDate?: string;
  healthInsuranceEnabled?: number;
  healthInsuranceExpiryDate?: string;
  unemploymentInsuranceEnabled?: number;
  unemploymentInsuranceExpiryDate?: string;
  imagePath?: string;
}

/** استخراج أول مفتاح وظيفة من professionKeys (مصادرة JSON) لعرض الأيقونة */
function getFirstProfessionKey(professionKeys: string | null | undefined): string | null {
  if (!professionKeys) return null;
  try {
    const arr = typeof professionKeys === 'string' ? JSON.parse(professionKeys) : professionKeys;
    return Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string' ? arr[0] : null;
  } catch { return null; }
}

type EmployeeExpiryKind =
  | 'passport'
  | 'emiratesId'
  | 'workCard'
  | 'contract'
  | 'loan'
  | 'healthInsurance'
  | 'unemploymentInsurance';

type EmployeeExpiryRow = {
  kind: EmployeeExpiryKind;
  label: string;
  date: string;
  info: ReturnType<typeof getExpiryStatus>;
};

const EMPTY_EMPLOYEE_EXPIRIES: EmployeeExpiryRow[] = [];

function expiryAllowedByField(permissions: PermissionEntry[] | undefined, kind: EmployeeExpiryKind): boolean {
  if (!permissions) return true;
  switch (kind) {
    case 'passport':
      return canEmployeesFieldView(permissions, 'field.passportExpiry.view');
    case 'emiratesId':
      return canEmployeesFieldView(permissions, 'field.emiratesIdExpiry.view');
    case 'workCard':
    case 'contract':
      return canEmployeesFieldView(permissions, 'field.contractExpiryField.view');
    case 'loan':
      return canEmployeesFieldView(permissions, 'field.secondedLoanDetails.view');
    case 'healthInsurance':
      return canEmployeesFieldView(permissions, 'field.healthInsuranceFields.view');
    case 'unemploymentInsurance':
      return canEmployeesFieldView(permissions, 'field.unemploymentInsuranceFields.view');
    default:
      return true;
  }
}

function computeEmployeeExpiries(
  emp: EmployeeRow,
  t: TFunction,
  expiryWarningDays: number,
  showGreenExpiry: boolean,
  showYellowExpiry: boolean,
  permissions: PermissionEntry[] | undefined
): EmployeeExpiryRow[] {
  const items: EmployeeExpiryRow[] = [];
  if (emp.passportExpiry && expiryAllowedByField(permissions, 'passport')) {
    items.push({
      kind: 'passport',
      label: t('employees.passport'),
      date: emp.passportExpiry,
      info: getExpiryStatus(emp.passportExpiry, expiryWarningDays),
    });
  }
  if (emp.emiratesIdExpiry && expiryAllowedByField(permissions, 'emiratesId')) {
    items.push({
      kind: 'emiratesId',
      label: t('employees.emiratesId'),
      date: emp.emiratesIdExpiry,
      info: getExpiryStatus(emp.emiratesIdExpiry, expiryWarningDays),
    });
  }
  if (emp.workCardExpiry && expiryAllowedByField(permissions, 'workCard')) {
    items.push({
      kind: 'workCard',
      label: t('employees.workCard'),
      date: emp.workCardExpiry,
      info: getExpiryStatus(emp.workCardExpiry, expiryWarningDays),
    });
  }
  if (emp.contractExpiryDate && expiryAllowedByField(permissions, 'contract')) {
    items.push({
      kind: 'contract',
      label: t('employees.workContract'),
      date: emp.contractExpiryDate,
      info: getExpiryStatus(emp.contractExpiryDate, expiryWarningDays),
    });
  }
  if (emp.loanExpiryDate && expiryAllowedByField(permissions, 'loan')) {
    items.push({
      kind: 'loan',
      label: t('employees.loan'),
      date: emp.loanExpiryDate,
      info: getExpiryStatus(emp.loanExpiryDate, expiryWarningDays),
    });
  }
  if (emp.healthInsuranceEnabled && expiryAllowedByField(permissions, 'healthInsurance')) {
    items.push({
      kind: 'healthInsurance',
      label: t('employees.healthInsurance'),
      date: emp.healthInsuranceExpiryDate || '',
      info: getExpiryStatus(emp.healthInsuranceExpiryDate, expiryWarningDays),
    });
  }
  if (emp.unemploymentInsuranceEnabled && expiryAllowedByField(permissions, 'unemploymentInsurance')) {
    items.push({
      kind: 'unemploymentInsurance',
      label: t('employees.unemploymentInsurance'),
      date: emp.unemploymentInsuranceExpiryDate || '',
      info: getExpiryStatus(emp.unemploymentInsuranceExpiryDate, expiryWarningDays),
    });
  }
  const filtered = items.filter((item) => {
    if (item.info.status === 'red') return true;
    if (item.info.status === 'green') return showGreenExpiry;
    return showYellowExpiry;
  });
  return filtered.sort((a, b) => (a.info.status === 'red' ? -1 : b.info.status === 'red' ? 1 : 0));
}

export default function Employees() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { can, loading: permLoading, permissions } = usePermissions();
  const { expiryWarningDays, showGreenExpiry, showYellowExpiry } = useExpiryUiSettings();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [viewMode, setViewMode] = usePersistedViewMode('employees_viewMode', 'list');

  const [filterBy, setFilterBy] = useState<EmployeeFilterBy>('');
  const [filterValue, setFilterValue] = useState<string>('');
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([]);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);

  const loadFilterOptions = useCallback(async (by: EmployeeFilterBy, signal?: AbortSignal) => {
    if (!window.electronAPI?.dbQuery || !by) {
      setFilterOptions([]);
      return;
    }
    setFilterOptionsLoading(true);
    try {
      if (by === 'branch') {
        const res = await dbQuery<{ id: number; name: string }[]>(
          `SELECT id, name FROM branches WHERE (status IS NULL OR status != 'archived') ORDER BY name`,
          undefined,
          { signal }
        );
        if (signal?.aborted) return;
        setFilterOptions((res?.data ?? []).map((r) => ({ id: String(r.id), label: r.name })));
      } else if (by === 'establishment') {
        const res = await dbQuery<{ id: number; name: string }[]>(
          `SELECT b.id, b.name FROM branches b
           INNER JOIN branch_establishments be ON be.branchId = b.id AND be.isEnabled = 1
           WHERE (b.status IS NULL OR b.status != 'archived') ORDER BY b.name`,
          undefined,
          { signal }
        );
        if (signal?.aborted) return;
        setFilterOptions((res?.data ?? []).map((r) => ({ id: String(r.id), label: r.name })));
      } else if (by === 'profession') {
        const res = await dbQuery<{ profession: string }[]>(
          `SELECT DISTINCT profession FROM employees WHERE (status IS NULL OR status != 'archived') AND profession IS NOT NULL AND TRIM(profession) != '' ORDER BY profession`,
          undefined,
          { signal }
        );
        if (signal?.aborted) return;
        const list = (res?.data ?? [])
          .map((r) => normalizeProfessionForFilter(r.profession))
          .filter(Boolean);
        const merged = [...new Set(list)].sort((a, b) => (a || '').localeCompare(b || ''));
        setFilterOptions(merged.map((p) => ({ id: p || '', label: p || '' })));
      } else {
        setFilterOptions([]);
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setFilterOptions([]);
    } finally {
      if (!signal?.aborted) setFilterOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    setFilterValue('');
    const ac = new AbortController();
    void loadFilterOptions(filterBy, ac.signal);
    return () => ac.abort();
  }, [filterBy, loadFilterOptions]);

  const loadEmployees = useCallback(
    async (signal?: AbortSignal) => {
      if (!window.electronAPI?.dbQuery) {
        setEmployees([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const baseWhere = `(e.status != 'archived' OR e.status IS NULL)`;
        let extraWhere = '';
        const params: (string | number)[] = [];
        if (filterBy === 'branch' && filterValue) {
          extraWhere = ` AND e.workBranchId = ?`;
          params.push(Number(filterValue));
        } else if (filterBy === 'establishment' && filterValue) {
          extraWhere = ` AND (e.workBranchId = ? OR e.contractBranchId = ?)`;
          params.push(Number(filterValue), Number(filterValue));
        } else if (filterBy === 'profession' && filterValue) {
          extraWhere = ` AND (e.profession = ? OR e.profession LIKE ?)`;
          params.push(filterValue, `${filterValue}:%`);
        }
        const whereClause = baseWhere + extraWhere;
        let res: { success?: boolean; data?: EmployeeRow[] } | undefined;
        try {
          res = (await dbQuery<EmployeeRow[]>(
            `SELECT e.id, e.code, e.name, e.phone, e.profession, e.professionPerContract, e.professionKeys, e.status, e.loanType, e.loanSubStatus, e.workBranchId, e.imagePath,
                  e.passportExpiry, e.emiratesIdExpiry, e.workCardExpiry, e.contractExpiryDate, e.loanExpiryDate,
                  e.healthInsuranceEnabled, e.healthInsuranceExpiryDate, e.unemploymentInsuranceEnabled, e.unemploymentInsuranceExpiryDate,
                  b.name as workBranchName, b.branchType as workBranchType,
                  (SELECT tradeName FROM branch_licenses WHERE branchId = e.workBranchId LIMIT 1) as workBranchTradeName
           FROM employees e
           LEFT JOIN branches b ON e.workBranchId = b.id
           WHERE ${whereClause}
           ORDER BY e.name`,
            params,
            { signal }
          )) as typeof res;
        } catch {
          res = undefined;
        }
        if (signal?.aborted) return;
        if (!res?.success || !res?.data) {
          res = (await dbQuery<EmployeeRow[]>(
            `SELECT e.id, e.code, e.name, e.phone, e.profession, e.professionPerContract, e.professionKeys, e.status, e.imagePath, e.workBranchId,
                  e.passportExpiry, e.emiratesIdExpiry, e.workCardExpiry, e.contractExpiryDate, e.loanExpiryDate,
                  e.healthInsuranceEnabled, e.healthInsuranceExpiryDate, e.unemploymentInsuranceEnabled, e.unemploymentInsuranceExpiryDate,
                  b.name as workBranchName, b.branchType as workBranchType,
                  (SELECT tradeName FROM branch_licenses WHERE branchId = e.workBranchId LIMIT 1) as workBranchTradeName
           FROM employees e
           LEFT JOIN branches b ON e.workBranchId = b.id
           WHERE ${whereClause}
           ORDER BY e.name`,
            params,
            { signal }
          )) as typeof res;
        }
        if (signal?.aborted) return;
        setEmployees(res?.success && res?.data ? res.data : []);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        setEmployees([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [filterBy, filterValue]
  );

  useEffect(() => {
    if (permLoading) return;
    if (!can('employees', 'view')) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    void loadEmployees(ac.signal);
    return () => ac.abort();
  }, [loadEmployees, permLoading, can]);

  const employeeExpiriesById = useMemo(() => {
    const m = new Map<number, EmployeeExpiryRow[]>();
    for (const emp of employees) {
      m.set(
        emp.id,
        computeEmployeeExpiries(emp, t, expiryWarningDays, showGreenExpiry, showYellowExpiry, permissions)
      );
    }
    return m;
  }, [employees, t, expiryWarningDays, showGreenExpiry, showYellowExpiry, permissions]);

  const showListPhoto = canEmployeesFieldView(permissions, 'field.profilePhoto.view');
  const showListPhone = canEmployeesFieldView(permissions, 'field.phone.view');
  const showListProfession = canEmployeesFieldView(permissions, 'field.professionDisplay.view');
  const showListBranch = canEmployeesFieldView(permissions, 'field.workBranchLink.view');

  const renderStatusBadge = (emp: EmployeeRow) => {
    const statusText = emp.status === EmploymentStatus.SECONDED && emp.loanType === LoanType.INTERNAL && emp.loanSubStatus === LoanSubStatus.ACTIVE
      ? t('employees.statusActive')
      : emp.status === EmploymentStatus.SECONDED && emp.loanType === LoanType.INTERNAL
        ? emp.loanSubStatus ? (LOAN_SUB_KEYS[emp.loanSubStatus] ? t(LOAN_SUB_KEYS[emp.loanSubStatus]) : emp.loanSubStatus) : t('employees.loanInternal')
        : WORK_STATUS_KEYS[emp.status] ? t(WORK_STATUS_KEYS[emp.status]) : emp.status;
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getWorkStatusBadgeClass(statusText)}`}>
        {statusText}
      </span>
    );
  };

  if (permLoading) {
    return (
      <div className="p-12 text-center text-secondary-gray">{t('common.loading')}</div>
    );
  }

  if (!can('employees', 'view')) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-red-600">{t('employees.noViewPermission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-dark-charcoal">{t('employees.title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={18} className="text-dark-charcoal/70" />
            <span className="text-sm text-dark-charcoal/80">{t('employees.filterBy')}</span>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as EmployeeFilterBy)}
              className="rounded-lg border border-secondary-gray px-3 py-2 text-sm bg-white min-w-[140px]"
            >
              <option value="">{t('employees.noFilter')}</option>
              <option value="establishment">{t('employees.establishment')}</option>
              <option value="branch">{t('employees.workBranch')}</option>
              <option value="profession">{t('employees.profession')}</option>
            </select>
            {filterBy && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                disabled={filterOptionsLoading}
                className="rounded-lg border border-secondary-gray px-3 py-2 text-sm bg-white min-w-[160px]"
              >
                <option value="">{t('employees.chooseFilter')}</option>
                {filterOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
          {!isMobile && <ViewModeToggle value={viewMode} onChange={setViewMode} />}
          <button
            type="button"
            onClick={() => void loadEmployees()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20 transition-colors"
            title={t('employees.refreshTitle')}
          >
            <RefreshCw size={18} />
          </button>
          {can('employees', 'create') && (
            <button
              type="button"
              onClick={() => { setEditId(null); setAddModalOpen(true); }}
              className="flex items-center gap-2 bg-primary-gold text-white px-6 py-2 rounded-lg hover:bg-accent-sand transition-colors"
            >
              <Plus size={20} /> {t('employees.addEmployee')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-secondary-gray">{t('common.loading')}</div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <User className="mx-auto mb-4 text-secondary-gray" size={48} />
            <p className="text-secondary-gray mb-4">{t('employees.noEmployees')}</p>
            {can('employees', 'create') && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="text-primary-gold hover:underline"
            >
              {t('employees.addFirstEmployee')}
            </button>
            )}
          </div>
        ) : viewMode === 'grid' || isMobile ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {employees.map((emp) => {
              const expiries = employeeExpiriesById.get(emp.id) ?? EMPTY_EMPLOYEE_EXPIRIES;
              return (
                <div
                  key={emp.id}
                  onClick={() => navigate(`/dashboard/employees/${emp.id}`)}
                  className="bg-white p-3 pb-4 border border-secondary-gray/50 rounded-md hover:border-primary-gold/50 hover:shadow-sm transition-all cursor-pointer flex flex-col relative"
                >
                  <div className="absolute top-3 left-3 z-10">
                    {renderStatusBadge(emp)}
                  </div>
                  <div className="flex justify-center mb-3">
                    {showListPhoto ? (
                      <EntityAvatar
                        imagePath={emp.imagePath}
                        className="w-16 h-16 rounded-full object-cover"
                        alt=""
                        fallback={
                          <div className="w-16 h-16 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-xl">
                            {emp.name?.charAt(0) || t('common.avatarFallback')}
                          </div>
                        }
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-xl">
                        {emp.name?.charAt(0) || t('common.avatarFallback')}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center text-center flex-1">
                    <h3 className="font-bold text-primary-gold text-lg min-h-[1.75rem]">
                      {emp.name?.trim() ? emp.name : t('employees.unnamedEmployee')}
                    </h3>
                    {emp.code && <span className="text-xs text-dark-charcoal/70 font-mono">{emp.code}</span>}
                    {showListProfession && (
                      <p className="text-sm text-dark-charcoal/70 mt-0.5 flex items-center justify-center gap-1.5">
                        {(() => {
                          const firstKey = getFirstProfessionKey(emp.professionKeys);
                          const Icon = firstKey ? PROFESSION_ICON_MAP[firstKey] : null;
                          return (
                            <>
                              {Icon && <Icon size={16} className="shrink-0 text-dark-charcoal/70" />}
                              <span>{emp.profession || emp.professionPerContract || '—'}</span>
                            </>
                          );
                        })()}
                      </p>
                    )}
                    {showListBranch && (emp.workBranchTradeName || emp.workBranchName) && (
                      <p className="text-sm text-dark-charcoal/80 mt-1 flex items-center justify-center gap-1 whitespace-nowrap">
                        {(() => {
                          const typeIcon = emp.workBranchType && BRANCH_TYPES.some((t) => t.value === emp.workBranchType)
                            ? BRANCH_TYPE_ICONS[emp.workBranchType as BranchTypeValue]
                            : Store;
                          const TypeIcon = typeIcon;
                          return <TypeIcon size={14} className="shrink-0 text-primary-gold" />;
                        })()}
                        <span>{emp.workBranchTradeName || emp.workBranchName}</span>
                      </p>
                    )}
                    {showListPhone && emp.phone && <p className="text-sm text-dark-charcoal/70 mt-0.5">{emp.phone}</p>}
                  </div>
                  {expiries.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-secondary-gray/50 flex flex-col gap-1.5">
                      {expiries.map((item, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-center gap-2 text-xs ${
                            item.info.status === 'red' ? 'text-alert-red' : item.info.status === 'yellow' || item.info.status === 'orange' ? 'text-yellow-700' : 'text-success-green'
                          }`}
                        >
                          {item.info.status === 'green' && <CheckCircle size={14} className="shrink-0 text-success-green" />}
                          {(item.info.status === 'yellow' || item.info.status === 'orange') && <AlertTriangle size={14} className="shrink-0 text-yellow-600" />}
                          {item.info.status === 'red' && <AlertCircle size={14} className="shrink-0 text-alert-red" />}
                          <span>
                            {item.info.isExpired
                              ? `${item.label}: ${t('employees.expiryExpired', { count: item.info.daysLeft != null ? Math.abs(item.info.daysLeft) : 0 })}`
                              : item.info.daysLeft != null && item.info.daysLeft > 0
                                ? `${item.label}: ${t('employees.expiryInDays', { count: item.info.daysLeft })}`
                                : `${item.label}: ${item.info.label}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : !isMobile ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-light-background">
                <tr>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal">{t('employees.tableEmployee')}</th>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal">{t('employees.tableProfession')}</th>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal">{t('employees.tableBranch')}</th>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal">{t('employees.tableWorkStatus')}</th>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal">{t('employees.tableExpiryAlerts')}</th>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="border-t border-secondary-gray/30 hover:bg-accent-sand/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/dashboard/employees/${emp.id}`)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {showListPhoto ? (
                            <EntityAvatar
                              imagePath={emp.imagePath}
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                              alt=""
                              fallback={
                                <div className="w-8 h-8 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-sm shrink-0">
                                  {emp.name?.charAt(0) || t('common.avatarFallback')}
                                </div>
                              }
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-sm shrink-0">
                              {emp.name?.charAt(0) || t('common.avatarFallback')}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-dark-charcoal">
                              {emp.name?.trim() ? emp.name : t('employees.unnamedEmployee')}
                              {emp.code ? ` (${emp.code})` : ''}
                            </p>
                            {showListPhone && emp.phone && <p className="text-sm text-secondary-gray">{emp.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {showListProfession ? (
                          <span className="inline-flex items-center gap-2 text-dark-charcoal">
                            {(() => {
                              const firstKey = getFirstProfessionKey(emp.professionKeys);
                              const Icon = firstKey ? PROFESSION_ICON_MAP[firstKey] : null;
                              return (
                                <>
                                  {Icon && <Icon size={18} className="shrink-0 text-dark-charcoal/80" />}
                                  <span>{emp.profession || emp.professionPerContract || '—'}</span>
                                </>
                              );
                            })()}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {showListBranch ? (
                          (emp.workBranchTradeName || emp.workBranchName) ? (
                            <span className="inline-flex items-center gap-2 text-dark-charcoal whitespace-nowrap">
                              {(() => {
                                const typeIcon = emp.workBranchType && BRANCH_TYPES.some((t) => t.value === emp.workBranchType)
                                  ? BRANCH_TYPE_ICONS[emp.workBranchType]
                                  : Store;
                                const TypeIcon = typeIcon;
                                return <TypeIcon size={14} className="shrink-0 text-primary-gold" />;
                              })()}
                              <span className="whitespace-nowrap">{emp.workBranchTradeName || emp.workBranchName}</span>
                            </span>
                          ) : (
                            '—'
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-4 px-4">{renderStatusBadge(emp)}</td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          {(employeeExpiriesById.get(emp.id) ?? EMPTY_EMPLOYEE_EXPIRIES).map((item, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 text-xs ${
                                item.info.status === 'red' ? 'text-alert-red' : item.info.status === 'yellow' || item.info.status === 'orange' ? 'text-yellow-700' : 'text-success-green'
                              }`}
                            >
                              {item.info.status === 'green' && <CheckCircle size={14} className="shrink-0 text-success-green" />}
                              {(item.info.status === 'yellow' || item.info.status === 'orange') && <AlertTriangle size={14} className="shrink-0 text-yellow-600" />}
                              {item.info.status === 'red' && <AlertCircle size={14} className="shrink-0 text-alert-red" />}
                              <span>
{item.info.isExpired
                                  ? `${item.label}: ${t('employees.expiryExpired', { count: item.info.daysLeft != null ? Math.abs(item.info.daysLeft) : 0 })}`
                                    : item.info.daysLeft != null && item.info.daysLeft > 0
                                    ? `${item.label}: ${t('employees.expiryInDays', { count: item.info.daysLeft })}`
                                    : `${item.label}: ${item.info.label}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/employees/${emp.id}`); }}
                          className="p-2 hover:bg-secondary-gray/30 rounded-lg"
                        >
                          <ChevronLeft size={18} className="rotate-180" />
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <AddEmployeeModal
        isOpen={addModalOpen}
        onClose={() => { setAddModalOpen(false); setEditId(null); }}
        onSuccess={() => void loadEmployees()}
        editEmployeeId={editId}
      />
    </div>
  );
}
