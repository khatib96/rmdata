import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Upload, Paperclip } from 'lucide-react';
import { DatePicker } from '../shared/DatePicker';
import { EmploymentStatus, LoanType, LoanSubStatus } from '../../constants/employee';
import { PROFESSIONS } from '../../constants/professions';
import { useAuthStore } from '../../store/authStore';
import { logActivity } from '../../utils/activityLog';
import { getEmployeeFormBranches, getEnabledEstablishmentBranchIds } from '../../services/branchService';
import {
  buildProfessionDisplay,
  LOAN_SUB_KEYS,
  WORK_STATUS_KEYS,
} from './updateStatusModal/updateStatusHelpers';

export interface EmployeeForStatus {
  id: number;
  name: string;
  status: string;
  workBranchId?: number | null;
  profession?: string | null;
  professionKeys?: string | null;
  professionCustomTitle?: string | null;
  professionPerContract?: string | null;
  actualSalary?: number | null;
  loanType?: string | null;
  loanBranchId?: number | null;
  loanProfession?: string | null;
  loanSubStatus?: string | null;
  loanExpiryDate?: string | null;
  tempContractNumber?: string | null;
  loanSalary?: number | null;
  targetEntityName?: string | null;
  loanLeaveStartDate?: string | null;
  loanLeaveEndDate?: string | null;
}

interface UpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  employee: EmployeeForStatus;
  /** إذا لم يوجد سجل في status_history = زر "تحديد حالة الموظف" */
  hasStatusHistory: boolean;
  /** تاريخ بداية آخر فترة (من status_history) لتحميله في الحقل وتصحيح التاريخ دون تغيير الحالة */
  lastPeriodStartDate?: string | null;
  lastPeriodEndDate?: string | null;
}

export default function UpdateStatusModal({
  isOpen,
  onClose,
  onSaved,
  employee,
  hasStatusHistory,
  lastPeriodStartDate,
  lastPeriodEndDate: _lastPeriodEndDate,
}: UpdateStatusModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const WORK_STATUS_OPTIONS = useMemo(() => [
    { value: EmploymentStatus.ACTIVE, label: t('employees.statusActive') },
    { value: EmploymentStatus.LEAVE, label: t('employees.statusLeave') },
    { value: EmploymentStatus.SUSPENDED, label: t('employees.statusSuspended') },
    { value: EmploymentStatus.INACTIVE, label: t('employees.statusInactive') },
    { value: EmploymentStatus.SECONDED, label: t('employees.statusSeconded') },
    { value: EmploymentStatus.TERMINATED, label: t('employees.statusTerminated') },
  ], [t]);
  const LOAN_TYPE_OPTIONS = useMemo(() => [
    { value: LoanType.EXTERNAL, label: t('employees.loanExternal') },
    { value: LoanType.INTERNAL, label: t('employees.loanInternalOption') },
  ], [t]);
  const LOAN_SUB_OPTIONS = useMemo(() => [
    { value: LoanSubStatus.ACTIVE, label: t('employees.loanActive') },
    { value: LoanSubStatus.LEAVE, label: t('employees.loanLeave') },
    { value: LoanSubStatus.INACTIVE, label: t('employees.loanInactive') },
  ], [t]);
  const [newStatus, setNewStatus] = useState(employee.status || EmploymentStatus.ACTIVE);
  const [actionDate, setActionDate] = useState(() => {
    const d = lastPeriodStartDate ? String(lastPeriodStartDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
    return d;
  });
  const [workBranchId, setWorkBranchId] = useState<string>(employee.workBranchId ? String(employee.workBranchId) : '');
  const [professionKeys, setProfessionKeys] = useState<string[]>(() => {
    try {
      const k = employee.professionKeys;
      if (typeof k === 'string' && k) return JSON.parse(k) ?? [];
      return Array.isArray(k) ? k : [];
    } catch { return []; }
  });
  const [professionCustomTitle, setProfessionCustomTitle] = useState(employee.professionCustomTitle || '');
  const [actualSalary, setActualSalary] = useState(employee.actualSalary ? String(employee.actualSalary) : '');
  const [loanType, setLoanType] = useState<string>(employee.loanType || '');
  const [loanBranchId, setLoanBranchId] = useState(employee.loanBranchId ? String(employee.loanBranchId) : '');
  const [loanProfession, setLoanProfession] = useState(employee.loanProfession || '');
  const [loanSubStatus, setLoanSubStatus] = useState(employee.loanSubStatus || '');
  const [loanExpiryDate, setLoanExpiryDate] = useState(employee.loanExpiryDate ? String(employee.loanExpiryDate).slice(0, 10) : '');
  const [tempContractNumber, setTempContractNumber] = useState(employee.tempContractNumber || '');
  const [loanSalary, setLoanSalary] = useState(employee.loanSalary ? String(employee.loanSalary) : '');
  const [targetEntityName, setTargetEntityName] = useState(employee.targetEntityName || '');
  const [loanLeaveStartDate, setLoanLeaveStartDate] = useState(employee.loanLeaveStartDate ? String(employee.loanLeaveStartDate).slice(0, 10) : '');
  const [loanLeaveEndDate, setLoanLeaveEndDate] = useState(employee.loanLeaveEndDate ? String(employee.loanLeaveEndDate).slice(0, 10) : '');
  /** عند التبديل من إجازة/متوقف/لا يعمل إلى يعمل: تاريخ انتهاء الحالة السابقة = تاريخ العودة للعمل */
  const [previousStatusEndDate, setPreviousStatusEndDate] = useState('');
  const [termDocPath, setTermDocPath] = useState<string | null>(null);
  const [termDocName, setTermDocName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<{ id: number; name: string; tradeName: string; hasEstablishment: boolean }[]>([]);

  const filteredBranches = branches.filter((b) => b.hasEstablishment);
  const showWorkDetails = newStatus === EmploymentStatus.ACTIVE || newStatus === EmploymentStatus.LEAVE || newStatus === EmploymentStatus.SUSPENDED;
  const showLoanDetails = newStatus === EmploymentStatus.SECONDED;
  const showTermination = newStatus === EmploymentStatus.TERMINATED;
  const loanWorkBranches = loanType === LoanType.INTERNAL ? branches : filteredBranches;

  /** التبديل من إجازة/متوقف/لا يعمل إلى يعمل (حالة أساسية) → مطلوب تاريخ انتهاء الحالة السابقة */
  const prevMainStatus = employee.status || '';
  const prevLoanSubStatus = employee.loanSubStatus || '';
  const mainReturnFromStatuses = [EmploymentStatus.LEAVE, EmploymentStatus.SUSPENDED, EmploymentStatus.INACTIVE] as string[];
  const loanReturnFromSubStatuses = [LoanSubStatus.LEAVE, LoanSubStatus.INACTIVE] as string[];
  const needReturnDateMain = newStatus === EmploymentStatus.ACTIVE && mainReturnFromStatuses.includes(prevMainStatus);
  /** التبديل من إجازة/لا يعمل إلى يعمل (إعارة داخلية) → مطلوب تاريخ العودة */
  const needReturnDateLoan = newStatus === EmploymentStatus.SECONDED && loanType === LoanType.INTERNAL && loanSubStatus === LoanSubStatus.ACTIVE &&
    loanReturnFromSubStatuses.includes(prevLoanSubStatus);
  const needReturnDate = needReturnDateMain || needReturnDateLoan;

  useEffect(() => {
    if (isOpen && employee) {
      setNewStatus(employee.status || EmploymentStatus.ACTIVE);
      setActionDate(lastPeriodStartDate ? String(lastPeriodStartDate).slice(0, 10) : new Date().toISOString().slice(0, 10));
      setWorkBranchId(employee.workBranchId ? String(employee.workBranchId) : '');
      try {
        const k = employee.professionKeys;
        setProfessionKeys(typeof k === 'string' && k ? JSON.parse(k) ?? [] : Array.isArray(k) ? k : []);
      } catch { setProfessionKeys([]); }
      setProfessionCustomTitle(employee.professionCustomTitle || '');
      setActualSalary(employee.actualSalary ? String(employee.actualSalary) : '');
      setLoanType(employee.loanType || '');
      setLoanBranchId(employee.loanBranchId ? String(employee.loanBranchId) : '');
      setLoanProfession(employee.loanProfession || '');
      setLoanSubStatus(employee.loanSubStatus || '');
      setLoanExpiryDate(employee.loanExpiryDate ? String(employee.loanExpiryDate).slice(0, 10) : '');
      setTempContractNumber(employee.tempContractNumber || '');
      setLoanSalary(employee.loanSalary ? String(employee.loanSalary) : '');
      setTargetEntityName(employee.targetEntityName || '');
      setLoanLeaveStartDate(employee.loanLeaveStartDate ? String(employee.loanLeaveStartDate).slice(0, 10) : '');
      setLoanLeaveEndDate(employee.loanLeaveEndDate ? String(employee.loanLeaveEndDate).slice(0, 10) : '');
      setPreviousStatusEndDate('');
      setTermDocPath(null);
      setTermDocName('');
    }
  }, [isOpen, employee, lastPeriodStartDate]);

  useEffect(() => {
    if (!isOpen || !window.electronAPI?.dbQuery) return;
    (async () => {
      const bRes = await getEmployeeFormBranches();
      const estRes = await getEnabledEstablishmentBranchIds();
      const estRows = (estRes?.data ?? []) as { branchId: number }[];
      const branchRows = (bRes?.data ?? []) as { id: number; name: string; tradeName?: string }[];
      const estIds = new Set(estRows.map((r) => r.branchId));
      setBranches(branchRows.map((r) => ({
        id: r.id, name: r.name, tradeName: r.tradeName || r.name || '', hasEstablishment: estIds.has(r.id),
      })));
    })();
  }, [isOpen]);

  /** الوظيفة الرئيسية (راديو — خيار واحد). الاستثناء: سائق يسمح بوظيفة إضافية واحدة. */
  const primaryProfession = professionKeys.includes('driver') ? 'driver' : (professionKeys[0] || '');
  const secondaryProfession = professionKeys.length === 2 ? (professionKeys.find((k) => k !== 'driver') || '') : '';

  const setPrimaryProfession = (key: string) => {
    setProfessionKeys(key === 'driver' ? ['driver'] : [key]);
  };
  const setSecondaryProfession = (key: string) => {
    setProfessionKeys((prev) => (prev[0] === 'driver' ? (key ? ['driver', key] : ['driver']) : prev));
  };

  const handleSelectTermDoc = async () => {
    const res = await window.electronAPI?.fileSelectDocument?.();
    if (res?.success && res?.filePath) {
      setTermDocPath(res.filePath);
      if (!termDocName) setTermDocName(res.filePath.replace(/^.*[/\\]/, ''));
    }
  };

  const handleSave = async () => {
    if (!newStatus) {
      setError(t('employees.selectStatus'));
      return;
    }
    if (!actionDate) {
      setError(t('employees.enterActivationDate'));
      return;
    }
    if (newStatus === EmploymentStatus.SECONDED && !loanType) {
      setError(t('employees.selectLoanType'));
      return;
    }
    if (newStatus === EmploymentStatus.SECONDED && loanType === LoanType.INTERNAL && loanBranchId && !loanSubStatus) {
      setError(t('employees.selectSubStatus'));
      return;
    }
    if (newStatus === EmploymentStatus.TERMINATED && !termDocPath) {
      setError(t('employees.attachTerminationDoc'));
      return;
    }
    if (needReturnDate && !previousStatusEndDate) {
      setError(t('employees.enterPreviousStatusEndDate'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const api = window.electronAPI;
      if (!api?.dbQuery) {
        setError(t('employees.connectionUnavailable'));
        setLoading(false);
        return;
      }

      const professionDisplay = buildProfessionDisplay(professionKeys, professionCustomTitle, t);
      const actSal = actualSalary ? parseFloat(actualSalary) : null;
      const lnSal = loanSalary ? parseFloat(loanSalary) : null;
      const workBr = workBranchId ? parseInt(workBranchId, 10) : null;
      const lnBr = loanBranchId ? parseInt(loanBranchId, 10) : null;
      const lnSub = loanSubStatus || null;
      const statusChanged = newStatus !== employee.status;
      /** عند العودة للعمل نستخدم تاريخ انتهاء الحالة السابقة كتاريخ فعلي للإغلاق والبدء */
      const effectiveDate = (needReturnDate && previousStatusEndDate) ? previousStatusEndDate : actionDate;

      const isTerminated = newStatus === EmploymentStatus.TERMINATED;
      const isInternalSeconded = newStatus === EmploymentStatus.SECONDED && loanType === LoanType.INTERNAL && loanBranchId;
      const loanLeaveStartVal = isTerminated ? null : (!isInternalSeconded ? null : (lnSub === LoanSubStatus.LEAVE || lnSub === LoanSubStatus.INACTIVE) ? (loanLeaveStartDate || actionDate) : (employee as EmployeeForStatus).loanLeaveStartDate ?? null);
      const loanLeaveEndVal = isTerminated ? null : (!isInternalSeconded ? null : lnSub === LoanSubStatus.ACTIVE ? (needReturnDateLoan && previousStatusEndDate ? previousStatusEndDate : (loanLeaveEndDate || effectiveDate)) : (loanLeaveEndDate || null));

      const oldWorkBr = employee.workBranchId ?? null;
      const oldProfDisplay = buildProfessionDisplay(
        (typeof employee.professionKeys === 'string' && employee.professionKeys ? (() => { try { return JSON.parse(employee.professionKeys!); } catch { return []; } })() : Array.isArray(employee.professionKeys) ? employee.professionKeys : []) as string[],
        employee.professionCustomTitle || '',
        t
      );
      const oldSal = employee.actualSalary != null ? Number(employee.actualSalary) : null;
      const onlyBranchProfSal = workBr === oldWorkBr && professionDisplay === oldProfDisplay && actSal === oldSal;

      const mainLeaveStatuses = [EmploymentStatus.LEAVE, EmploymentStatus.SUSPENDED, EmploymentStatus.INACTIVE] as string[];
      const mainDateChanged = !statusChanged && mainLeaveStatuses.includes(prevMainStatus) && (actionDate !== (lastPeriodStartDate || '').slice(0, 10));
      const secondedDateChanged = !statusChanged && employee.status === EmploymentStatus.SECONDED &&
        (loanLeaveStartDate !== (employee.loanLeaveStartDate || '').slice(0, 10) || loanLeaveEndDate !== (employee.loanLeaveEndDate || '').slice(0, 10));
      const isDateOnlyCorrection = onlyBranchProfSal && (mainDateChanged || secondedDateChanged);

      if (isDateOnlyCorrection) {
        if (mainDateChanged) {
          const lastRes = await api.dbQuery(
            "SELECT id, startDate, endDate FROM status_history WHERE entityType = 'employee' AND entityId = ? ORDER BY startDate DESC LIMIT 1",
            [employee.id]
          );
          const last = lastRes?.data?.[0] as { id: number; startDate: string; endDate?: string } | undefined;
          if (last?.id) {
            const end = last.endDate ? String(last.endDate).slice(0, 10) : null;
            const durationDays = end ? Math.round((new Date(end).getTime() - new Date(actionDate).getTime()) / (1000 * 60 * 60 * 24)) : null;
            await api.dbQuery(
              'UPDATE status_history SET startDate = ?, durationDays = ? WHERE id = ?',
              [actionDate, durationDays ?? 0, last.id]
            );
          }
        }
        await api.dbQuery(
          `UPDATE employees SET status = ?, workBranchId = ?, profession = ?, professionKeys = ?, professionCustomTitle = ?, actualSalary = ?, loanType = ?, loanBranchId = ?, loanProfession = ?, loanSubStatus = ?, loanExpiryDate = ?, tempContractNumber = ?, loanSalary = ?, targetEntityName = ?, loanLeaveStartDate = ?, loanLeaveEndDate = ? WHERE id = ?`,
          [
            newStatus,
            isTerminated ? null : (isInternalSeconded ? workBr : showWorkDetails ? workBr : null),
            isTerminated ? null : (professionDisplay || null),
            isTerminated ? null : JSON.stringify(professionKeys),
            isTerminated ? null : (professionCustomTitle || null),
            isTerminated ? null : (showWorkDetails || isInternalSeconded ? actSal : null),
            isTerminated ? null : (newStatus === EmploymentStatus.SECONDED ? (loanType || null) : null),
            isTerminated ? null : (newStatus === EmploymentStatus.SECONDED ? lnBr : null),
            isTerminated ? null : (newStatus === EmploymentStatus.SECONDED ? (loanType === LoanType.INTERNAL ? (professionDisplay || null) : (loanProfession || null)) : null),
            isTerminated ? null : (newStatus === EmploymentStatus.SECONDED ? lnSub : null),
            isTerminated ? null : (newStatus === EmploymentStatus.SECONDED && loanExpiryDate ? loanExpiryDate : null),
            isTerminated ? null : (newStatus === EmploymentStatus.SECONDED ? (tempContractNumber || null) : null),
            isTerminated ? null : (newStatus === EmploymentStatus.SECONDED && lnSal ? lnSal : null),
            isTerminated ? null : (newStatus === EmploymentStatus.SECONDED && loanType === LoanType.EXTERNAL ? (targetEntityName || null) : null),
            loanLeaveStartVal,
            loanLeaveEndVal,
            employee.id,
          ]
        );
        const dateDetail = mainDateChanged
          ? `dateCorrection::leaveStart::${actionDate}`
          : `dateCorrection::loanLeave::${loanLeaveStartDate || ''}::${loanLeaveEndDate || ''}`;
        await logActivity({
          module: 'employee',
          action: 'date_correction',
          entityType: 'employee',
          entityId: employee.id,
          details: dateDetail,
          performedByUserId: user?.id,
          performedByUsername: user?.username ?? user?.fullName ?? undefined,
        });
        onSaved();
        onClose();
        setLoading(false);
        return;
      }

      // 1 و 2: تحديث status_history فقط عند تغيير الحالة (وليس عند تحديث الفرع/الراتب/الوظيفة فقط)
      if (statusChanged) {
        const lastRes = await api.dbQuery(
          "SELECT id, startDate FROM status_history WHERE entityType = 'employee' AND entityId = ? ORDER BY startDate DESC LIMIT 1",
          [employee.id]
        );
        const lastRecord = lastRes?.data?.[0] as { id?: number; startDate?: string } | undefined;
        if (lastRecord?.startDate) {
          const prevStart = String(lastRecord.startDate).slice(0, 10);
          const start = new Date(prevStart);
          const end = new Date(effectiveDate);
          const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          await api.dbQuery('UPDATE status_history SET endDate = ?, durationDays = ? WHERE id = ?', [effectiveDate, durationDays, lastRecord.id]);
        } else if (employee.status) {
          await api.dbQuery(
            `INSERT INTO status_history (entityType, entityId, status, startDate, endDate, durationDays, performedByUserId, performedByUsername)
             VALUES ('employee', ?, ?, ?, ?, 0, ?, ?)`,
            [employee.id, employee.status, effectiveDate, effectiveDate, user?.id ?? null, user?.username ?? user?.fullName ?? null]
          );
        }
        await api.dbQuery(
          `INSERT INTO status_history (entityType, entityId, status, startDate, performedByUserId, performedByUsername)
           VALUES ('employee', ?, ?, ?, ?, ?)`,
          [employee.id, newStatus, effectiveDate, user?.id ?? null, user?.username ?? user?.fullName ?? null]
        );
      }

      // 3. تحديث employees (الفرع، الوظيفة، الراتب، إلخ.) — يعمل دائماً سواء تغيرت الحالة أم لا
      const updateCols: string[] = ['status = ?', 'workBranchId = ?', 'profession = ?', 'professionKeys = ?', 'professionCustomTitle = ?', 'actualSalary = ?', 'loanType = ?', 'loanBranchId = ?', 'loanProfession = ?', 'loanSubStatus = ?', 'loanExpiryDate = ?', 'tempContractNumber = ?', 'loanSalary = ?', 'targetEntityName = ?', 'loanLeaveStartDate = ?', 'loanLeaveEndDate = ?'];
      const updateVals: unknown[] = [
        newStatus,
        isTerminated ? null : (isInternalSeconded ? workBr : showWorkDetails ? workBr : null),
        isTerminated ? null : (professionDisplay || null),
        isTerminated ? null : JSON.stringify(professionKeys),
        isTerminated ? null : (professionCustomTitle || null),
        isTerminated ? null : (showWorkDetails || isInternalSeconded ? actSal : null),
        isTerminated ? null : (newStatus === EmploymentStatus.SECONDED ? (loanType || null) : null),
        isTerminated ? null : (newStatus === EmploymentStatus.SECONDED ? lnBr : null),
        isTerminated ? null : (newStatus === EmploymentStatus.SECONDED ? (loanType === LoanType.INTERNAL ? (professionDisplay || null) : (loanProfession || null)) : null),
        isTerminated ? null : (newStatus === EmploymentStatus.SECONDED ? lnSub : null),
        isTerminated ? null : (newStatus === EmploymentStatus.SECONDED && loanExpiryDate ? loanExpiryDate : null),
        isTerminated ? null : (newStatus === EmploymentStatus.SECONDED ? (tempContractNumber || null) : null),
        isTerminated ? null : (newStatus === EmploymentStatus.SECONDED && lnSal ? lnSal : null),
        isTerminated ? null : (newStatus === EmploymentStatus.SECONDED && loanType === LoanType.EXTERNAL ? (targetEntityName || null) : null),
        loanLeaveStartVal,
        loanLeaveEndVal,
      ];
      await api.dbQuery(
        `UPDATE employees SET ${updateCols.join(', ')} WHERE id = ?`,
        [...updateVals, employee.id]
      );

      // 4. Save termination document
      if (newStatus === EmploymentStatus.TERMINATED && termDocPath && api.documentSave) {
        const parts = termDocPath.replace(/\\/g, '/').split('/');
        const base = parts[parts.length - 1] || 'file';
        const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
        const name = termDocName.trim() ? termDocName.trim().replace(/[/\\:*?"<>|]/g, '_') + ext : base;
        const relPath = `Employees/${employee.id}/termination/${name}`;
        await api.documentSave({
          sourceFilePath: termDocPath,
          relativePath: relPath,
          customName: termDocName.trim() || base,
          entityType: 'employee',
          entityId: employee.id,
          section: 'termination',
        });
      }

      // بناء تفاصيل السجل — كل ما يتم من نافذة تحديث الحالة يُسجّل كـ "تحديث حالة" مع التفاصيل (نستخدم oldWorkBr, oldProfDisplay, oldSal المعرّفة أعلاه)
      const parts: string[] = [];

      if (statusChanged) {
        const fromLabel = WORK_STATUS_KEYS[employee.status] ? t(WORK_STATUS_KEYS[employee.status]) : employee.status;
        const toLabel = WORK_STATUS_KEYS[newStatus] ? t(WORK_STATUS_KEYS[newStatus]) : newStatus;
        parts.push(`${fromLabel} → ${toLabel} (${effectiveDate})`);
        if (needReturnDate && previousStatusEndDate) {
          parts.push(`تاريخ العودة للعمل: ${previousStatusEndDate}`);
        }
      }
      // معار داخلياً: تسجيل تغيير الحالة الفرعية بنفس وضوح الحالة الأساسية (يعمل ↔ إجازة/لا يعمل) مع التواريخ لحساب أيام العمل والإجازة
      if (newStatus === EmploymentStatus.SECONDED && loanType === LoanType.INTERNAL && lnSub !== (employee.loanSubStatus || null)) {
        const fromSub = LOAN_SUB_KEYS[employee.loanSubStatus || ''] ? t(LOAN_SUB_KEYS[employee.loanSubStatus || '']) : employee.loanSubStatus || '—';
        const toSub = LOAN_SUB_KEYS[lnSub || ''] ? t(LOAN_SUB_KEYS[lnSub || '']) : lnSub || '—';
        parts.push(`معار (داخلي): ${fromSub} → ${toSub}`);
        if (lnSub === LoanSubStatus.LEAVE || lnSub === LoanSubStatus.INACTIVE) {
          const startDate = loanLeaveStartDate || actionDate;
          if (startDate) parts.push(lnSub === LoanSubStatus.LEAVE ? `تاريخ بداية الإجازة: ${startDate}` : `تاريخ بداية عدم العمل: ${startDate}`);
        } else if (lnSub === LoanSubStatus.ACTIVE && previousStatusEndDate) {
          parts.push(`تاريخ العودة للعمل: ${previousStatusEndDate}`);
        }
      }
      if (workBr !== oldWorkBr && (showWorkDetails || (newStatus === EmploymentStatus.SECONDED && loanType === LoanType.INTERNAL))) {
        const newBranch = branches.find((b) => b.id === workBr);
        const branchName = newBranch ? (newBranch.tradeName && newBranch.tradeName !== newBranch.name ? `${newBranch.tradeName} - ${newBranch.name}` : newBranch.name) : '';
        if (workBr && branchName) parts.push(`تم نقل الموظف إلى الفرع ${branchName}`);
        else if (!workBr) parts.push('تم إلغاء تعيين الفرع');
      }
      if (professionDisplay !== oldProfDisplay && (showWorkDetails || (newStatus === EmploymentStatus.SECONDED && loanType === LoanType.INTERNAL))) {
        parts.push(professionDisplay ? `تم تغيير الوظيفة إلى "${professionDisplay}"` : 'تم تغيير الوظيفة');
      }
      if ((actSal != null || oldSal != null) && actSal !== oldSal && (showWorkDetails || (newStatus === EmploymentStatus.SECONDED && loanType === LoanType.INTERNAL))) {
        if (actSal != null && oldSal != null) {
          const diff = actSal - oldSal;
          if (diff > 0) parts.push(`تم تغيير الراتب من ${oldSal.toLocaleString('en')} إلى ${actSal.toLocaleString('en')} درهم — زيادة ${diff.toLocaleString('en')} درهم`);
          else if (diff < 0) parts.push(`تم تغيير الراتب من ${oldSal.toLocaleString('en')} إلى ${actSal.toLocaleString('en')} درهم — خفض ${Math.abs(diff).toLocaleString('en')} درهم`);
        } else if (actSal != null && (oldSal == null)) {
          parts.push(`تم تغيير الراتب إلى ${actSal.toLocaleString('en')} درهم`);
        } else if (actSal == null && oldSal != null) {
          parts.push('تم إلغاء الراتب');
        }
      }
      const logDetails = parts.length > 0 ? parts.join('؛ ') : '';

      await logActivity({
        module: 'employee',
        action: 'status_change',
        entityType: 'employee',
        entityId: employee.id,
        details: `statusChange::${newStatus}::${logDetails}`,
        performedByUserId: user?.id,
        performedByUsername: user?.username ?? user?.fullName ?? undefined,
      });

      onSaved();
      onClose();
    } catch (e) {
      setError(t('employees.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const inputClass = 'w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white';
  const labelClass = 'block text-sm font-medium text-dark-charcoal mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[60] pt-20 pb-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[calc(100vh-6rem)] overflow-y-auto p-6 border border-secondary-gray shrink-0 modal-box-mobile">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary-gold flex items-center gap-2">
            <Calendar size={20} /> {hasStatusHistory ? t('employees.statusModalTitle') : t('employees.statusModalTitleSet')}
          </h3>
          <button onClick={handleClose} className="text-dark-charcoal hover:text-primary-gold min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={t('nav.close')}>
            <X size={22} />
          </button>
        </div>
        <p className="text-sm text-dark-charcoal/70 mb-4">{t('employees.employeeLabel')}: {employee.name}</p>
        {hasStatusHistory && (
          <p className="text-sm text-dark-charcoal/70 mb-4">{t('employees.currentStatus')}: {WORK_STATUS_KEYS[employee.status] ? t(WORK_STATUS_KEYS[employee.status]) : employee.status}</p>
        )}

        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('employees.statusLabel')}</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={inputClass}>
              {WORK_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* عند العودة من إجازة/متوقف/لا يعمل إلى يعمل (حالة أساسية): نعرض فقط تاريخ العودة للعمل وليس حقلين */}
          {!needReturnDateMain && (
            <div>
              <label className={labelClass}>
                {newStatus === EmploymentStatus.LEAVE ? t('employees.leaveStartDate') :
                  newStatus === EmploymentStatus.SUSPENDED ? t('employees.suspendedStartDate') :
                    newStatus === EmploymentStatus.INACTIVE ? t('employees.inactiveStartDate') : t('employees.activationDate')}
              </label>
              <DatePicker value={actionDate} onChange={setActionDate} placeholder={t('employees.chooseDate')} />
              {(newStatus === EmploymentStatus.LEAVE || newStatus === EmploymentStatus.SUSPENDED || newStatus === EmploymentStatus.INACTIVE) && (
                <p className="text-xs text-dark-charcoal/60 mt-1">{t('employees.dateHint')}</p>
              )}
            </div>
          )}

          {needReturnDateMain && (
            <div className="border border-primary-gold/50 rounded-lg p-4 bg-amber-50/40">
              <label className={labelClass}>
                {t('employees.returnToWorkDateRequired')}
              </label>
              <DatePicker
                value={previousStatusEndDate}
                onChange={setPreviousStatusEndDate}
                placeholder={t('employees.chooseReturnDate')}
              />
              <p className="text-xs text-dark-charcoal/60 mt-1">{t('employees.returnDateHint')}</p>
            </div>
          )}

          {showWorkDetails && (
            <div className="border border-secondary-gray rounded-lg p-4 space-y-4">
              <h4 className="text-primary-gold font-medium">{t('employees.workDetails')}</h4>
              <div>
                <label className={labelClass}>{t('employees.workBranchLabel')}</label>
                <select value={workBranchId} onChange={(e) => setWorkBranchId(e.target.value)} className={inputClass}>
                  <option value="">-- {t('employees.chooseBranch')} --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.tradeName && b.tradeName !== b.name ? `${b.tradeName} - ${b.name}` : b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('employees.professionLabel')}</label>
                <div className="space-y-2">
                  {PROFESSIONS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <label key={p.key} className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="profession-primary" checked={primaryProfession === p.key} onChange={() => setPrimaryProfession(p.key)} className="text-primary-gold" />
                        <Icon size={20} className="text-dark-charcoal/70 shrink-0" />
                        <span>{t(`employees.profession_${p.key}`)}</span>
                        {p.hasCustomTitle && primaryProfession === p.key && (
                          <input type="text" placeholder={p.key === 'admin' ? t('employees.adminPlaceholder') : t('employees.titlePlaceholder')} value={professionCustomTitle} onChange={(e) => setProfessionCustomTitle(e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm" />
                        )}
                      </label>
                    );
                  })}
                </div>
                {primaryProfession === 'driver' && (
                  <div className="mt-3 pr-6 border-t border-secondary-gray/50 pt-3">
                    <p className="text-sm text-dark-charcoal/70 mb-2">{t('employees.secondaryProfession')}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="profession-secondary" checked={!secondaryProfession} onChange={() => setSecondaryProfession('')} className="text-primary-gold" />
                        <span>{t('employees.noSecondary')}</span>
                      </label>
                      {PROFESSIONS.filter((p) => p.key !== 'driver').map((p) => {
                        const Icon = p.icon;
                        return (
                          <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="profession-secondary" checked={secondaryProfession === p.key} onChange={() => setSecondaryProfession(p.key)} className="text-primary-gold" />
                            <Icon size={18} className="text-dark-charcoal/70 shrink-0" />
                            <span>{t(`employees.profession_${p.key}`)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>{t('employees.actualSalary')}</label>
                <input type="number" step="0.01" value={actualSalary} onChange={(e) => setActualSalary(e.target.value)} className={inputClass} placeholder={t('employees.optional')} />
              </div>
            </div>
          )}

          {showLoanDetails && (
            <div className="border border-secondary-gray rounded-lg p-4 space-y-4">
              <h4 className="text-primary-gold font-medium">{t('employees.loanTypeLabel')}</h4>
              <div>
                <select value={loanType} onChange={(e) => setLoanType(e.target.value)} className={inputClass}>
                  <option value="">-- {t('employees.chooseOption')} --</option>
                  {LOAN_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {loanType === LoanType.EXTERNAL && (
                <>
                  <div><label className={labelClass}>{t('employees.targetEntityName')}</label><input type="text" value={targetEntityName} onChange={(e) => setTargetEntityName(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t('employees.loanExpiryDate')}</label><DatePicker value={loanExpiryDate} onChange={setLoanExpiryDate} placeholder={t('employees.chooseDate')} /></div>
                </>
              )}
              {loanType === LoanType.INTERNAL && (
                <>
                  <div>
                    <label className={labelClass}>{t('employees.loanedEstablishment')}</label>
                    <select value={loanBranchId} onChange={(e) => setLoanBranchId(e.target.value)} className={inputClass}>
                      <option value="">-- {t('employees.chooseEstablishment')} --</option>
                      {filteredBranches.map((b) => (
                        <option key={b.id} value={b.id}>{b.tradeName && b.tradeName !== b.name ? `${b.tradeName} - ${b.name}` : b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div><label className={labelClass}>{t('employees.tempContractNo')}</label><input type="text" value={tempContractNumber} onChange={(e) => setTempContractNumber(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t('employees.loanSalaryLabel')}</label><input type="number" step="0.01" value={loanSalary} onChange={(e) => setLoanSalary(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t('employees.loanExpiryDate')}</label><DatePicker value={loanExpiryDate} onChange={setLoanExpiryDate} placeholder={t('employees.chooseDate')} /></div>
                  {loanBranchId && (
                    <>
                      <div>
                        <label className={labelClass}>{t('employees.workBranchLabel')}</label>
                        <select value={workBranchId} onChange={(e) => setWorkBranchId(e.target.value)} className={inputClass}>
                          <option value="">-- {t('employees.chooseBranch')} --</option>
                          {loanWorkBranches.map((b) => (
                            <option key={b.id} value={b.id}>{b.tradeName && b.tradeName !== b.name ? `${b.tradeName} - ${b.name}` : b.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>{t('employees.professionLabel')}</label>
                        <div className="space-y-2">
                          {PROFESSIONS.map((p) => {
                            const Icon = p.icon;
                            return (
                              <label key={p.key} className="flex items-center gap-3 cursor-pointer">
                                <input type="radio" name="profession-primary-loan" checked={primaryProfession === p.key} onChange={() => setPrimaryProfession(p.key)} className="text-primary-gold" />
                                <Icon size={20} className="text-dark-charcoal/70 shrink-0" />
                                <span>{t(`employees.profession_${p.key}`)}</span>
                                {p.hasCustomTitle && primaryProfession === p.key && (
                                  <input type="text" placeholder={p.key === 'admin' ? t('employees.adminPlaceholder') : t('employees.titlePlaceholder')} value={professionCustomTitle} onChange={(e) => setProfessionCustomTitle(e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm" />
                                )}
                              </label>
                            );
                          })}
                        </div>
                        {primaryProfession === 'driver' && (
                          <div className="mt-3 pr-6 border-t border-secondary-gray/50 pt-3">
                            <p className="text-sm text-dark-charcoal/70 mb-2">{t('employees.secondaryProfession')}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="profession-secondary-loan" checked={!secondaryProfession} onChange={() => setSecondaryProfession('')} className="text-primary-gold" />
                                <span>{t('employees.noSecondary')}</span>
                              </label>
                              {PROFESSIONS.filter((p) => p.key !== 'driver').map((p) => {
                                const Icon = p.icon;
                                return (
                                  <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="profession-secondary-loan" checked={secondaryProfession === p.key} onChange={() => setSecondaryProfession(p.key)} className="text-primary-gold" />
                                    <Icon size={18} className="text-dark-charcoal/70 shrink-0" />
                                    <span>{t(`employees.profession_${p.key}`)}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className={labelClass}>{t('employees.subStatusLabel')}</label>
                        <select value={loanSubStatus} onChange={(e) => setLoanSubStatus(e.target.value)} className={inputClass}>
                          <option value="">-- {t('employees.chooseOption')} --</option>
                          {LOAN_SUB_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      {/* تاريخ انتهاء الحالة السابقة (تحت الحالة الفرعية): يظهر عند التبديل من إجازة/لا يعمل إلى يعمل */}
                      {needReturnDateLoan && (
                        <div className="border border-primary-gold/50 rounded-lg p-3 bg-amber-50/40">
                          <label className={labelClass}>
                            {t('employees.previousStatusEndDateRequired')}
                          </label>
                          <DatePicker
                            value={previousStatusEndDate}
                            onChange={setPreviousStatusEndDate}
                            placeholder={t('employees.chooseReturnDate')}
                          />
                          <p className="text-xs text-dark-charcoal/60 mt-1">{t('employees.returnDateHintLoan')}</p>
                        </div>
                      )}
                      {/* تفاصيل الإجازة/عدم العمل (إعارة داخلية): تاريخ البداية فقط — تاريخ العودة يُسجّل عند تغيير الحالة الفرعية إلى «يعمل» */}
                      {(loanSubStatus === LoanSubStatus.LEAVE || loanSubStatus === LoanSubStatus.INACTIVE) && (
                        <div className="border border-primary-gold/30 rounded-lg p-3 space-y-3 bg-amber-50/30">
                          <h5 className="text-sm font-medium text-primary-gold">{t('employees.leaveInactiveDetails')}</h5>
                          <div>
                            <label className={labelClass}>
                              {loanSubStatus === LoanSubStatus.LEAVE ? t('employees.leaveStartDateLoan') : t('employees.inactiveStartDateLoan')}
                            </label>
                            <DatePicker
                              value={loanLeaveStartDate || actionDate}
                              onChange={(v) => setLoanLeaveStartDate(v)}
                              placeholder={t('employees.chooseDate')}
                            />
                            <p className="text-xs text-dark-charcoal/60 mt-1">{t('employees.returnDateHintLoanSub')}</p>
                          </div>
                        </div>
                      )}
                      <div><label className={labelClass}>{t('employees.actualSalary')}</label><input type="number" step="0.01" value={actualSalary} onChange={(e) => setActualSalary(e.target.value)} className={inputClass} placeholder={t('employees.optional')} /></div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {showTermination && (
            <div className="border border-amber-200 rounded-lg p-4 space-y-4 bg-amber-50/50">
              <h4 className="text-primary-gold font-medium flex items-center gap-2"><Paperclip size={18} /> {t('employees.terminationDocRequired')}</h4>
              <p className="text-sm text-dark-charcoal/70">{t('employees.terminationDocHint')}</p>
              <div>
                <button type="button" onClick={handleSelectTermDoc} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10">
                  <Upload size={18} /> {t('employees.selectFile')}
                </button>
                {termDocPath && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-dark-charcoal/80 truncate flex-1">{termDocPath.replace(/^.*[/\\]/, '')}</span>
                    <input type="text" value={termDocName} onChange={(e) => setTermDocName(e.target.value)} placeholder={t('employees.docName')} className="px-2 py-1 border rounded text-sm w-40" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
        <div className="flex gap-3 mt-6 justify-end">
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-lg border border-secondary-gray text-dark-charcoal hover:bg-secondary-gray/20">
            {t('employees.cancel')}
          </button>
          <button type="button" onClick={handleSave} disabled={loading} className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand disabled:opacity-60">
            {loading ? t('employees.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
