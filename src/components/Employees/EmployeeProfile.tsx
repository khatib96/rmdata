import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User,
  FileText,
  CreditCard,
  Briefcase,
  Shield,
  FolderOpen,
  History,
  Phone,
  Trash2,
  Archive,
} from 'lucide-react';
import { EmploymentStatus, LoanType, LoanSubStatus } from '../../constants/employee';
import UpdateExpiryPopup, { type UpdateExpiryConfig, type DocumentLinkConfig } from '../shared/UpdateExpiryPopup';
import TabsOrDropdown from '../shared/TabsOrDropdown';
import UpdateStatusModal from './UpdateStatusModal';
import AddEmployeeModal from './AddEmployeeModal';
import DocumentPreviewModal from '../shared/DocumentPreviewModal';
import { logActivity } from '../../utils/activityLog';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { canEmployeesFieldView, canEmployeesSensitiveAction } from '../../services/permissionsService';
import {
  canEmployeeUiTab,
  filterEmployeeDocumentsByPermissions,
  type EmployeeProfileTabId,
} from '../../services/employeePermissions';
import EmployeeHeader from './profile/EmployeeHeader';
import EmployeeSummary from './profile/EmployeeSummary';
import EmployeeDocuments from './profile/EmployeeDocuments';
import EmployeePhones from './profile/EmployeePhones';
import EmployeeHistory from './profile/EmployeeHistory';
import type { EmployeeCurrentPeriod, EmployeeDetails, EmployeeDocument, EmployeePhone } from './profile/types';
import type { DocumentPreview } from '../../types/documents';

const EMPLOYEE_PROFILE_QUERY = `SELECT
  e.id, e.code, e.name, e.nationality, e.email, e.phone, e.imagePath,
  e.passportNumber, e.passportIssueDate, e.passportExpiry,
  e.emiratesId, e.emiratesIdIssueDate, e.emiratesIdExpiry, e.issueEmirate,
  e.employerName, e.establishmentNumber, e.immigrationEstablishmentNumber,
  e.contractType, e.profession, e.professionKeys, e.professionCustomTitle, e.professionPerContract,
  e.contractStartDate, e.contractExpiryDate,
  e.basicSalary, e.housingAllowance, e.transportAllowance, e.otherAllowances, e.totalSalary,
  e.status, e.loanType, e.loanSubStatus, e.targetEntityName, e.loanExpiryDate, e.tempContractNumber,
  e.loanSalary, e.loanBranchId, e.loanProfession, e.workBranchId, e.contractBranchId, e.actualSalary,
  e.healthInsuranceEnabled, e.healthInsuranceProvider, e.healthInsuranceIssueDate, e.healthInsuranceExpiryDate,
  e.unemploymentInsuranceEnabled, e.unemploymentInsuranceProvider, e.unemploymentInsuranceIssueDate, e.unemploymentInsuranceExpiryDate,
  e.loanLeaveStartDate, e.loanLeaveEndDate,
  b.name as workBranchName, b.branchType as workBranchType,
  cb.name as contractBranchName,
  (SELECT tradeName FROM branch_licenses WHERE branchId = e.contractBranchId LIMIT 1) as contractBranchTradeName,
  lb.name as loanBranchName,
  (SELECT tradeName FROM branch_licenses WHERE branchId = e.loanBranchId LIMIT 1) as loanBranchTradeName
  FROM employees e
  LEFT JOIN branches b ON e.workBranchId = b.id
  LEFT JOIN branches cb ON e.contractBranchId = cb.id
  LEFT JOIN branches lb ON e.loanBranchId = lb.id
  WHERE e.id = ?`;

const WORK_STATUS_KEYS: Record<string, string> = {
  [EmploymentStatus.ACTIVE]: 'employees.statusActive',
  [EmploymentStatus.LEAVE]: 'employees.statusLeave',
  [EmploymentStatus.SUSPENDED]: 'employees.statusSuspended',
  [EmploymentStatus.SECONDED]: 'employees.statusSeconded',
  [EmploymentStatus.INACTIVE]: 'employees.statusInactive',
  [EmploymentStatus.VISA_CANCELLED]: 'employees.statusVisaCancelled',
  [EmploymentStatus.TERMINATED]: 'employees.statusTerminated',
  [EmploymentStatus.ARCHIVED]: 'employees.archive',
};

const LOAN_SUB_KEYS: Record<string, string> = {
  [LoanSubStatus.ACTIVE]: 'employees.loanActive',
  [LoanSubStatus.LEAVE]: 'employees.loanLeave',
  [LoanSubStatus.INACTIVE]: 'employees.loanInactive',
};

export default function EmployeeProfile() {
  const { t } = useTranslation();
  const TABS = useMemo(() => [
    { id: 'basic', label: t('employees.tabBasic'), icon: User },
    { id: 'passport', label: t('employees.tabPassport'), icon: FileText },
    { id: 'contract', label: t('employees.tabContract'), icon: Briefcase },
    { id: 'residency', label: t('employees.tabResidency'), icon: CreditCard },
    { id: 'insurances', label: t('employees.tabInsurances'), icon: Shield },
    { id: 'work-status', label: t('employees.tabWorkStatus'), icon: Briefcase },
    { id: 'phones', label: t('employees.tabPhones'), icon: Phone },
    { id: 'history', label: t('employees.tabHistory'), icon: History },
    { id: 'documents', label: t('employees.tabDocs'), icon: FolderOpen },
  ] as const, [t]);

  type TabId = EmployeeProfileTabId;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const employeeId = id ? parseInt(id, 10) : NaN;

  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [docPreview, setDocPreview] = useState<DocumentPreview | null>(null);
  const [expiryPopup, setExpiryPopup] = useState<{ config: UpdateExpiryConfig; documentConfig?: DocumentLinkConfig; currentExpiry?: string; title: string; activityLogParams?: { module: string; action: string; entityType: string; entityId?: number; details: string } } | null>(null);
  const [updateStatusOpen, setUpdateStatusOpen] = useState(false);
  const [hasStatusHistory, setHasStatusHistory] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<EmployeeCurrentPeriod | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [employeePhones, setEmployeePhones] = useState<EmployeePhone[]>([]);

  const { can, loading: permLoading, permissions } = usePermissions();

  const loadEmployeeDetails = useCallback(async () => {
    if (!window.electronAPI?.dbQuery || isNaN(employeeId)) return;
    setLoading(true);
    try {
      const [employeeRes, docRes, phonesRes, periodRes] = await Promise.all([
        window.electronAPI.dbQuery(EMPLOYEE_PROFILE_QUERY, [employeeId]),
        window.electronAPI.documentList?.('employee', employeeId),
        window.electronAPI.dbQuery(
          `SELECT id, phoneNumber, provider, category, numberType, registeredName
           FROM phones
           WHERE assignedEmployeeId = ? AND (status IS NULL OR status != 'archived')`,
          [employeeId]
        ),
        window.electronAPI.dbQuery(
          `SELECT status, startDate, endDate, durationDays
           FROM status_history
           WHERE entityType = 'employee' AND entityId = ?
           ORDER BY startDate DESC, id DESC LIMIT 1`,
          [employeeId]
        ),
      ]);

      const emp = employeeRes?.data?.[0] as EmployeeDetails | undefined;
      if (!emp) {
        setEmployee(null);
        setDocuments([]);
        setEmployeePhones([]);
        setCurrentPeriod(null);
        setHasStatusHistory(false);
        setImageUrl(null);
        return;
      }

      setEmployee(emp);
      setDocuments(docRes?.success && Array.isArray(docRes.data) ? (docRes.data as EmployeeDocument[]) : []);
      setEmployeePhones((phonesRes?.data ?? []) as EmployeePhone[]);

      const periodRow = periodRes?.data?.[0] as EmployeeCurrentPeriod | undefined;
      setCurrentPeriod(periodRow ?? null);
      setHasStatusHistory(!!periodRow);

      if (emp.imagePath && window.electronAPI.fileGetImageUrl) {
        const img = await window.electronAPI.fileGetImageUrl(emp.imagePath);
        setImageUrl(img.success && img.url ? img.url : null);
      } else {
        setImageUrl(null);
      }
    } catch (e) {
      console.error(e);
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId || Number.isNaN(employeeId)) return;
    if (permLoading) return;
    if (!can('employees', 'view')) {
      setEmployee(null);
      setDocuments([]);
      setEmployeePhones([]);
      setCurrentPeriod(null);
      setHasStatusHistory(false);
      setImageUrl(null);
      setLoading(false);
      return;
    }
    void loadEmployeeDetails();
  }, [employeeId, loadEmployeeDetails, permLoading, can]);

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => canEmployeeUiTab(permissions, tab.id as EmployeeProfileTabId)),
    [TABS, permissions]
  );

  const visibleDocuments = useMemo(
    () => filterEmployeeDocumentsByPermissions(documents, permissions),
    [documents, permissions]
  );

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some((x) => x.id === activeTab)) {
      setActiveTab(visibleTabs[0].id as TabId);
    }
  }, [visibleTabs, activeTab]);

  const user = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const updateLinkedEntityImagePath = useAuthStore((s) => s.updateLinkedEntityImagePath);
  const performerLabel = user ? `${user.fullName || user.username}${user.entityId != null ? ` (${user.entityId})` : ''}` : t('employees.systemLabel');

  const refreshLinkedAvatar = useCallback(async () => {
    if (!user?.id || user.linkedEntityType !== 'employee' || user.linkedEntityId !== employeeId) return;
    try {
      const res = await window.electronAPI?.authRefreshLinkedImage?.(user.id);
      if (res?.success) updateLinkedEntityImagePath(res.linkedEntityImagePath ?? null);
    } catch { /* best-effort */ }
  }, [user, employeeId, updateLinkedEntityImagePath]);

  const handleArchive = async () => {
    if (!window.electronAPI?.archiveRecord && !window.electronAPI?.dbQuery) return;
    try {
      if (window.electronAPI.archiveRecord) {
        const res = await window.electronAPI.archiveRecord(sessionToken, 'employees', employeeId);
        if (!res?.success) throw new Error(res?.error || 'ARCHIVE_FAILED');
      } else if (window.electronAPI.dbQuery) {
        await window.electronAPI.dbQuery('UPDATE employees SET status = ? WHERE id = ?', ['archived', employeeId]);
      }
      const label = employee?.name || employee?.code || `موظف ${employeeId}`;
      await logActivity({
        module: 'archive',
        action: 'archive',
        entityType: 'employee',
        entityId: employeeId,
        details: `archived::employee::${label}::${performerLabel}`,
        performedByUserId: user?.id,
        performedByUsername: user?.fullName || user?.username,
        performedByUserCode: user?.username,
      });
      setArchiveConfirm(false);
      navigate('/dashboard/employees');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!window.electronAPI?.archiveDeletePermanent && !window.electronAPI?.dbQuery) return;
    try {
      if (window.electronAPI.archiveDeletePermanent) {
        const res = await window.electronAPI.archiveDeletePermanent(sessionToken, 'employees', employeeId);
        if (!res?.success) throw new Error(res?.error || 'DELETE_FAILED');
      } else if (window.electronAPI.dbQuery) {
        await window.electronAPI.dbQuery('DELETE FROM status_history WHERE entityType = ? AND entityId = ?', ['employee', employeeId]);
        await window.electronAPI.dbQuery('UPDATE vehicles SET responsibleEmployeeId = NULL WHERE responsibleEmployeeId = ?', [employeeId]);
        await window.electronAPI.dbQuery('DELETE FROM notifications WHERE entityType = ? AND entityId = ?', ['employee', employeeId]);
        await window.electronAPI.dbQuery('DELETE FROM employees WHERE id = ?', [employeeId]);
      }
      setDeleteConfirm(false);
      navigate('/dashboard/employees');
    } catch (e) {
      console.error(e);
    }
  };

  const openExpiryPopup = (
    type: 'passport' | 'contract' | 'emiratesId' | 'healthInsurance' | 'unemploymentInsurance' | 'loan'
  ) => {
    if (!employee) return;
    const configs = {
      passport: {
        config: { table: 'employees', column: 'passportExpiry', recordId: employeeId },
        documentConfig: { entityType: 'employee', entityId: employeeId, section: 'passport_expiry' },
        currentExpiry: employee.passportExpiry ? String(employee.passportExpiry).slice(0, 10) : undefined,
        title: t('employees.updatePassportExpiry'),
        activityLogParams: { module: 'employee', action: 'expiry_update', entityType: 'employee', entityId: employeeId, details: 'expiryUpdate::passport::{newDate}' },
      },
      contract: {
        config: { table: 'employees', column: 'contractExpiryDate', recordId: employeeId },
        documentConfig: { entityType: 'employee', entityId: employeeId, section: 'contract_expiry' },
        currentExpiry: employee.contractExpiryDate ? String(employee.contractExpiryDate).slice(0, 10) : undefined,
        title: t('employees.updateContractExpiry'),
        activityLogParams: { module: 'employee', action: 'expiry_update', entityType: 'employee', entityId: employeeId, details: 'expiryUpdate::contract::{newDate}' },
      },
      emiratesId: {
        config: { table: 'employees', column: 'emiratesIdExpiry', recordId: employeeId },
        documentConfig: { entityType: 'employee', entityId: employeeId, section: 'emirates_id_expiry' },
        currentExpiry: employee.emiratesIdExpiry ? String(employee.emiratesIdExpiry).slice(0, 10) : undefined,
        title: t('employees.updateEmiratesIdExpiry'),
        activityLogParams: { module: 'employee', action: 'expiry_update', entityType: 'employee', entityId: employeeId, details: 'expiryUpdate::emiratesId::{newDate}' },
      },
      healthInsurance: {
        config: { table: 'employees', column: 'healthInsuranceExpiryDate', recordId: employeeId },
        documentConfig: { entityType: 'employee', entityId: employeeId, section: 'health_insurance_expiry' },
        currentExpiry: employee.healthInsuranceExpiryDate ? String(employee.healthInsuranceExpiryDate).slice(0, 10) : undefined,
        title: t('employees.updateHealthInsuranceExpiry'),
        activityLogParams: { module: 'employee', action: 'expiry_update', entityType: 'employee', entityId: employeeId, details: 'expiryUpdate::healthInsurance::{newDate}' },
      },
      unemploymentInsurance: {
        config: { table: 'employees', column: 'unemploymentInsuranceExpiryDate', recordId: employeeId },
        documentConfig: { entityType: 'employee', entityId: employeeId, section: 'unemployment_insurance_expiry' },
        currentExpiry: employee.unemploymentInsuranceExpiryDate ? String(employee.unemploymentInsuranceExpiryDate).slice(0, 10) : undefined,
        title: t('employees.updateUnemploymentExpiry'),
        activityLogParams: { module: 'employee', action: 'expiry_update', entityType: 'employee', entityId: employeeId, details: 'expiryUpdate::unemploymentInsurance::{newDate}' },
      },
      loan: {
        config: { table: 'employees', column: 'loanExpiryDate', recordId: employeeId },
        documentConfig: { entityType: 'employee', entityId: employeeId, section: 'loan_expiry' },
        currentExpiry: employee.loanExpiryDate ? String(employee.loanExpiryDate).slice(0, 10) : undefined,
        title: t('employees.updateLoanExpiry'),
        activityLogParams: { module: 'employee', action: 'expiry_update', entityType: 'employee', entityId: employeeId, details: 'expiryUpdate::loan::{newDate}' },
      },
    } as const;

    setExpiryPopup(configs[type]);
  };

  const handlePreviewDocument = async (doc: EmployeeDocument, name: string) => {
    const res = await window.electronAPI?.documentGetUrl?.(doc.relativePath);
    if (res?.success && res?.url) {
      setDocPreview({ url: res.url, name, relativePath: doc.relativePath });
    }
  };

  const handleDeleteDocument = async (doc: EmployeeDocument, name: string) => {
    if (!confirm(t('employees.confirmDeleteDoc', { name }))) return;
    const res = await window.electronAPI?.documentDelete?.(doc.id);
    if (res?.success) loadEmployeeDetails();
  };

  if (isNaN(employeeId)) {
    navigate('/dashboard/employees');
    return null;
  }

  if (loading || permLoading) {
    return (
      <div className="p-12 text-center text-secondary-gray">{t('common.loading')}</div>
    );
  }

  if (!can('employees', 'view')) {
    return (
      <div className="p-12 text-center">
        <p className="text-red-600 mb-4">{t('employees.noViewPermission')}</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard/employees')}
          className="text-primary-gold hover:underline"
        >
          {t('employees.backToList')}
        </button>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-12 text-center">
        <p className="text-red-600 mb-4">{t('employees.loadFailed')}</p>
        <button
          onClick={() => navigate('/dashboard/employees')}
          className="text-primary-gold hover:underline"
        >
          {t('employees.backToList')}
        </button>
      </div>
    );
  }

  const workStatusDisplay =
    employee.status === EmploymentStatus.SECONDED && employee.loanType === LoanType.INTERNAL
      ? (employee.loanSubStatus ? (LOAN_SUB_KEYS[employee.loanSubStatus] ? t(LOAN_SUB_KEYS[employee.loanSubStatus]) : employee.loanSubStatus) : t('employees.loanInternal'))
      : WORK_STATUS_KEYS[employee.status] ? t(WORK_STATUS_KEYS[employee.status]) : employee.status;

  const empRow = employee;

  const isNonWorkingStatus = (s: string) => s === EmploymentStatus.LEAVE || s === EmploymentStatus.SUSPENDED || s === EmploymentStatus.INACTIVE;
  const isNonWorkingSubStatus = (s: string) => s === LoanSubStatus.LEAVE || s === LoanSubStatus.INACTIVE;

  function getDurationText(): string | null {
    const today = new Date().toISOString().slice(0, 10);
    const toDays = (start: string, end?: string | null) => {
      const s = new Date(String(start).slice(0, 10));
      const e = end ? new Date(String(end).slice(0, 10)) : new Date(today);
      return Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
    };

    if (empRow.status === EmploymentStatus.SECONDED && empRow.loanType === LoanType.INTERNAL && empRow.loanBranchId) {
      if (isNonWorkingSubStatus(empRow.loanSubStatus || '')) {
        const start = empRow.loanLeaveStartDate;
        if (start) {
          const days = toDays(start, empRow.loanLeaveEndDate);
          return empRow.loanLeaveEndDate
            ? (empRow.loanSubStatus === LoanSubStatus.LEAVE ? t('employees.durationLeaveDays', { count: days }) : t('employees.durationInactiveDays', { count: days }))
            : (empRow.loanSubStatus === LoanSubStatus.LEAVE ? t('employees.leaveSinceDays', { count: days }) : t('employees.inactiveSinceDays', { count: days }));
        }
      } else if (empRow.loanLeaveStartDate && empRow.loanLeaveEndDate) {
        const days = toDays(empRow.loanLeaveStartDate, empRow.loanLeaveEndDate);
        return t('employees.lastLeaveDays', { count: days });
      }
      return null;
    }

    if (isNonWorkingStatus(empRow.status) && currentPeriod && currentPeriod.status === empRow.status && !currentPeriod.endDate) {
      const days = toDays(currentPeriod.startDate);
      return empRow.status === EmploymentStatus.LEAVE ? t('employees.leaveSinceDays', { count: days }) : empRow.status === EmploymentStatus.SUSPENDED ? t('employees.suspendedSinceDays', { count: days }) : t('employees.inactiveSinceDays', { count: days });
    }

    if ((empRow.status === EmploymentStatus.ACTIVE || (empRow.status === EmploymentStatus.SECONDED && empRow.loanSubStatus === LoanSubStatus.ACTIVE)) && currentPeriod && currentPeriod.endDate && isNonWorkingStatus(currentPeriod.status) && currentPeriod.durationDays != null) {
      return currentPeriod.status === EmploymentStatus.LEAVE
        ? t('employees.lastLeaveDays', { count: currentPeriod.durationDays })
        : currentPeriod.status === EmploymentStatus.SUSPENDED
          ? t('employees.lastSuspendedDays', { count: currentPeriod.durationDays })
          : t('employees.lastInactiveDays', { count: currentPeriod.durationDays });
    }
    return null;
  }

  const durationText = getDurationText();

  const canEditEmployee = can('employees', 'edit');
  const canChangeStatus = canEmployeesSensitiveAction(permissions, 'changeStatus');
  const canDeleteDocuments = canEmployeesSensitiveAction(permissions, 'deleteDocuments');

  const tabsForBar = visibleTabs.map((tb) =>
    tb.id === 'phones' && employeePhones.length > 0 ? { ...tb, badge: employeePhones.length } : tb
  );

  return (
    <div className="animate-in fade-in duration-200">
      <EmployeeHeader
        employee={employee}
        imageUrl={imageUrl}
        workStatusDisplay={workStatusDisplay}
        durationText={durationText}
        hasStatusHistory={hasStatusHistory}
        onBack={() => navigate('/dashboard/employees')}
        onEdit={() => setEditModalOpen(true)}
        onUpdateStatus={() => setUpdateStatusOpen(true)}
        showEdit={canEditEmployee}
        showUpdateStatus={canChangeStatus}
        showProfilePhoto={canEmployeesFieldView(permissions, 'field.profilePhoto.view')}
        showProfession={canEmployeesFieldView(permissions, 'field.professionDisplay.view')}
      />

      {visibleTabs.length === 0 ? (
        <div className="bg-white rounded-lg border border-secondary-gray p-8 text-center text-secondary-gray">
          {t('employees.noTabPermission')}
        </div>
      ) : (
        <>
          <TabsOrDropdown
            tabs={tabsForBar}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as TabId)}
          />

          <div className="bg-white rounded-lg border border-secondary-gray p-6">
            {(activeTab === 'basic' || activeTab === 'passport' || activeTab === 'contract' || activeTab === 'residency' || activeTab === 'insurances' || activeTab === 'work-status') && (
              <EmployeeSummary
                activeTab={activeTab}
                employee={employee}
                employeePhones={employeePhones}
                workStatusDisplay={workStatusDisplay}
                onOpenExpiryPopup={canEditEmployee ? openExpiryPopup : undefined}
                permissions={permissions}
              />
            )}

            {activeTab === 'history' && <EmployeeHistory employeeId={employeeId} employeeName={employee.name} />}

            {activeTab === 'documents' && (
              <EmployeeDocuments
                documents={visibleDocuments}
                onPreview={handlePreviewDocument}
                onOpenExternal={(relativePath) => window.electronAPI?.documentOpenExternal?.(relativePath)}
                onDelete={handleDeleteDocument}
                allowDelete={canDeleteDocuments}
              />
            )}

            {activeTab === 'phones' && (
              <EmployeePhones
                employeePhones={employeePhones}
                onNavigatePhone={(phoneId) => navigate(`/dashboard/phones/${phoneId}`)}
              />
            )}
          </div>
        </>
      )}

      <AddEmployeeModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => { setEditModalOpen(false); loadEmployeeDetails().then(refreshLinkedAvatar); }}
        editEmployeeId={employeeId}
      />

      <UpdateStatusModal
        isOpen={updateStatusOpen}
        onClose={() => setUpdateStatusOpen(false)}
        onSaved={() => { setUpdateStatusOpen(false); loadEmployeeDetails(); }}
        employee={employee}
        hasStatusHistory={hasStatusHistory}
        lastPeriodStartDate={currentPeriod?.startDate}
        lastPeriodEndDate={currentPeriod?.endDate}
      />

      {expiryPopup && (
        <UpdateExpiryPopup
          isOpen
          onClose={() => setExpiryPopup(null)}
          onSaved={() => { setExpiryPopup(null); loadEmployeeDetails(); }}
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

      {(can('employees', 'archive') || can('employees', 'delete')) && (
        <div className="mt-8 pt-6 border-t border-secondary-gray flex gap-3 justify-end">
          {can('employees', 'archive') && (
            <button
              type="button"
              onClick={() => setArchiveConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/50 text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <Archive size={18} />
              {t('employees.archive')}
            </button>
          )}
          {can('employees', 'delete') && (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/50 text-red-700 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={18} />
              {t('employees.delete')}
            </button>
          )}
        </div>
      )}

      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setArchiveConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <Archive size={28} />
              <h3 className="font-bold text-lg">{t('employees.confirmArchiveTitle')}</h3>
            </div>
            <p className="text-dark-charcoal mb-4">{t('employees.confirmArchiveMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setArchiveConfirm(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('employees.cancel')}</button>
              <button onClick={handleArchive} className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t('employees.archive')}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Trash2 size={28} />
              <h3 className="font-bold text-lg">{t('employees.confirmDeleteTitle')}</h3>
            </div>
            <p className="text-dark-charcoal mb-4">{t('employees.confirmDeleteMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('employees.cancel')}</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">{t('employees.deletePermanent')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
