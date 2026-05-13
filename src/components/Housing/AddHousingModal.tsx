import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Upload, FileText } from 'lucide-react';
import { DatePicker } from '../shared/DatePicker';
import toast from 'react-hot-toast';
import { generateNextCode } from '../../utils/entityCode';
import { HOUSING_TYPES, OWNED_BY_OPTIONS, housingTypeFormToDb } from '../../constants/housing';
import { DocumentNameModal } from '../shared/DocumentNameModal';
import {
  AddHousingLeaseContractSection,
  type HousingFormLeaseShape,
  type LeasePaymentType,
} from './AddHousingLeaseContractSection';
import { UAE_EMIRATES, getEmirateLabel } from '../../constants/uae';
import { useLanguageStore } from '../../store/languageStore';
import { logActivity } from '../../utils/activityLog';
import { buildChangeSummary } from '../../utils/buildChangeSummary';
import { useAuthStore } from '../../store/authStore';

interface AddHousingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editHousingId?: number | null;
}

interface BranchOption {
  id: number;
  name: string;
  emirate: string;
  tradeName: string | null;
}

interface EmployeeOption {
  id: number;
  name: string;
  code?: string;
}

interface EmployerOption {
  id: number;
  name: string;
  code?: string;
}

interface CustomRow {
  id: string;
  key: string;
  value: string;
  isDate: boolean;
  enableAlert?: boolean;
  alertDate?: string;
  daysBeforeExpiry?: number;
}

interface CustomSection {
  id: string;
  title: string;
  rows: CustomRow[];
}

const INITIAL = {
  name: '',
  housingType: 'labour',
  ownedBy: 'company' as 'company' | 'employee' | 'employer' | 'other',
  emirate: '',
  address: '',
  landlordName: '',
  tenantDisplayName: '',
  contractNo: '',
  contractIssue: '',
  contractExpiry: '',
  rentAmount: '',
  paymentMethod: '',
  leasePaymentType: 'single' as LeasePaymentType,
  leaseInstallments: [] as { id: string; amount: string; dueDate: string; note: string }[],
  branchId: '',
  employeeId: '',
  employerId: '',
  otherPartyName: '',
};

export default function AddHousingModal({ isOpen, onClose, onSuccess, editHousingId }: AddHousingModalProps) {
  const { t } = useTranslation();
  const lang = useLanguageStore((s) => s.language);
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employers, setEmployers] = useState<EmployerOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employerSearch, setEmployerSearch] = useState('');
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [pendingDocs, setPendingDocs] = useState<{ sectionKey: string; sectionLabel: string; sourcePath: string; customName: string }[]>([]);
  const [docModal, setDocModal] = useState<{ sectionKey: string; sectionLabel: string; sourcePath: string; customName: string } | null>(null);
  const oldFormRef = useRef<Record<string, unknown> | null>(null);
  const isEdit = !!editHousingId;

  const selectedBranch = useMemo(() => branches.find((b) => String(b.id) === form.branchId), [branches, form.branchId]);
  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) => e.name?.toLowerCase().includes(q) || (e.code && e.code.toLowerCase().includes(q))
    );
  }, [employees, employeeSearch]);
  const filteredEmployers = useMemo(() => {
    const q = employerSearch.trim().toLowerCase();
    if (!q) return employers;
    return employers.filter(
      (e) => e.name?.toLowerCase().includes(q) || (e.code && e.code.toLowerCase().includes(q))
    );
  }, [employers, employerSearch]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!isOpen || !api?.dbQuery) return;
    (async () => {
      const bRes = await api.dbQuery(
        `SELECT b.id, b.name, b.emirate, (SELECT tradeName FROM branch_licenses WHERE branchId = b.id LIMIT 1) as tradeName
         FROM branches b WHERE (b.status IS NULL OR b.status != 'archived')
         ORDER BY b.name`
      );
      const rows = (bRes?.data ?? []) as { id: number; name: string; emirate: string; tradeName: string | null }[];
      setBranches(rows.map((r) => ({ id: r.id, name: r.name, emirate: r.emirate || '', tradeName: r.tradeName || null })));

      const eRes = await api.dbQuery(
        "SELECT id, name, code FROM employees WHERE (status IS NULL OR status != 'archived') ORDER BY name"
      );
      setEmployees((eRes?.data ?? []) as EmployeeOption[]);
      const empRes = await api.dbQuery(
        "SELECT id, fullName as name, code FROM employers WHERE (status IS NULL OR status != 'archived') ORDER BY fullName"
      );
      setEmployers((empRes?.data ?? []) as EmployerOption[]);
    })();
  }, [isOpen]);

  useEffect(() => {
    if (form.ownedBy === 'company' && form.branchId && selectedBranch) {
      setForm((f) => ({ ...f, emirate: selectedBranch.emirate || f.emirate }));
    }
  }, [form.ownedBy, form.branchId, selectedBranch?.id]);

  useEffect(() => {
    if (!isOpen) return;
    if (!editHousingId) {
      setForm(INITIAL);
      setCustomSections([]);
      setPendingDocs([]);
      setError('');
      setEmployeeSearch('');
      setEmployerSearch('');
      return;
    }
    (async () => {
      if (!window.electronAPI?.dbQuery) return;
      const [unitRes, instRes, cfRes] = await Promise.all([
        window.electronAPI.dbQuery('SELECT * FROM housing_units WHERE id = ?', [editHousingId]),
        window.electronAPI.dbQuery('SELECT id, seq, amount, dueDate, note FROM housing_installments WHERE housingId = ? ORDER BY seq', [editHousingId]),
        window.electronAPI.dbQuery('SELECT * FROM housing_custom_fields WHERE housingUnitId = ?', [editHousingId]),
      ]);
      const row = unitRes?.data?.[0] as Record<string, unknown> | undefined;
      const installments = (instRes?.data ?? []) as { id: number; seq: number; amount: number; dueDate?: string; note?: string }[];
      const cfs = (cfRes?.data ?? []) as { id: number; title: string; content?: string; enableAlert?: number; alertDate?: string; daysBeforeExpiry?: number }[];
      if (!row) return;

      let housingType = String(row.housingType ?? 'labour');
      if (housingType === 'family') housingType = 'personal';

      const loadedForm = {
        name: String(row.name ?? ''),
        housingType,
        ownedBy: String(row.ownedBy ?? 'company') as 'company' | 'employee' | 'employer' | 'other',
        emirate: String(row.emirate ?? ''),
        address: String(row.address ?? ''),
        landlordName: String(row.landlordName ?? ''),
        tenantDisplayName: String(row.tenantDisplayName ?? ''),
        contractNo: String(row.contractNo ?? ''),
        contractIssue: row.contractIssue ? String(row.contractIssue).slice(0, 10) : '',
        contractExpiry: row.contractExpiry ? String(row.contractExpiry).slice(0, 10) : '',
        rentAmount: row.rentAmount != null ? String(row.rentAmount) : '',
        paymentMethod: String(row.paymentMethod ?? ''),
        leasePaymentType: (installments.length > 0 ? 'multiple' : 'single') as LeasePaymentType,
        leaseInstallments: installments.length > 0
          ? installments.map((i) => ({
              id: `i${i.id}`,
              amount: String(i.amount),
              dueDate: i.dueDate ? String(i.dueDate).slice(0, 10) : '',
              note: i.note || '',
            }))
          : [],
        branchId: row.branchId != null ? String(row.branchId) : '',
        employeeId: row.employeeId != null ? String(row.employeeId) : '',
        employerId: row.employerId != null ? String(row.employerId) : '',
        otherPartyName: String(row.ownedBy) === 'other' ? String(row.tenantDisplayName ?? '') : '',
      };
      setForm(loadedForm);
      oldFormRef.current = { ...loadedForm };

      const parsedSections: CustomSection[] = [];
      for (const f of cfs) {
        try {
          const content = f.content || '{}';
          const parsed = content.startsWith('{') ? JSON.parse(content) : { rows: [] };
          if (parsed.rows?.length) {
            parsedSections.push({
              id: String(f.id),
              title: f.title || '',
              rows: parsed.rows.map((r: Record<string, unknown>) => ({
                id: String(r.id ?? Date.now()),
                key: String(r.key ?? ''),
                value: String(r.value ?? (r.enableAlert && r.isDate ? r.alertDate : '')),
                isDate: !!r.isDate,
                enableAlert: !!r.enableAlert,
                alertDate: String(r.alertDate ?? (r.enableAlert && r.isDate ? r.value : '')),
                daysBeforeExpiry: (r.daysBeforeExpiry as number) ?? 30,
              })),
            });
          } else {
            parsedSections.push({ id: String(f.id), title: f.title || '', rows: [{ id: '1', key: '', value: '', isDate: false }] });
          }
        } catch {
          parsedSections.push({ id: String(f.id), title: f.title || '', rows: [{ id: '1', key: '', value: '', isDate: false }] });
        }
      }
      setCustomSections(parsedSections);
      setError('');
    })();
  }, [isOpen, editHousingId]);

  const addCustomSection = () => {
    setCustomSections((s) => [...s, { id: `sec${Date.now()}`, title: '', rows: [{ id: `r${Date.now()}`, key: '', value: '', isDate: false }] }]);
  };
  const removeCustomSection = (sectionId: string) => {
    setCustomSections((s) => s.filter((x) => x.id !== sectionId));
  };
  const updateCustomSection = (sectionId: string, _field: 'title', value: string) => {
    setCustomSections((s) => s.map((sec) => (sec.id === sectionId ? { ...sec, title: value } : sec)));
  };
  const addCustomRow = (sectionId: string) => {
    setCustomSections((s) =>
      s.map((sec) => (sec.id === sectionId ? { ...sec, rows: [...sec.rows, { id: `r${Date.now()}`, key: '', value: '', isDate: false }] } : sec))
    );
  };
  const removeCustomRow = (sectionId: string, rowId: string) => {
    setCustomSections((s) =>
      s.map((sec) => (sec.id === sectionId ? { ...sec, rows: sec.rows.filter((r) => r.id !== rowId) } : sec))
    );
  };
  const updateCustomRow = (sectionId: string, rowId: string, field: keyof CustomRow, value: string | number | boolean) => {
    setCustomSections((s) =>
      s.map((sec) =>
        sec.id === sectionId
          ? {
              ...sec,
              rows: sec.rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
            }
          : sec
      )
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name?.trim()) {
      setError(t('housing.addModal.unitNameRequiredError'));
      return;
    }
    if (form.contractNo && form.leasePaymentType === 'multiple') {
      const validInst = form.leaseInstallments.filter((i) => (parseFloat(i.amount) || 0) > 0 && i.dueDate);
      if (validInst.length === 0) {
        setError(t('housing.addModal.addAtLeastOneInstallment'));
        return;
      }
    }
    if (form.contractNo && form.leasePaymentType === 'single' && !form.rentAmount) {
      setError(t('housing.addModal.enterContractValue'));
      return;
    }

    setLoading(true);
    try {
      const api = window.electronAPI;
      if (!api?.dbQuery) throw new Error(t('housing.addModal.dbUnavailable'));

      const branchId = form.branchId ? parseInt(form.branchId, 10) : null;
      const employeeId = form.employeeId ? parseInt(form.employeeId, 10) : null;
      const employerId = form.employerId ? parseInt(form.employerId, 10) : null;
      const rentAmount =
        form.leasePaymentType === 'single'
          ? (form.rentAmount ? parseFloat(form.rentAmount) : null)
          : form.leaseInstallments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) || null;
      const installmentsCount =
        form.leasePaymentType === 'multiple' ? form.leaseInstallments.filter((i) => (parseFloat(i.amount) || 0) > 0 && i.dueDate).length : 0;
      const selectedBranchForSave = branches.find((b) => String(b.id) === form.branchId);
      const selectedEmployeeForSave = employees.find((e) => String(e.id) === form.employeeId);
      const selectedEmployerForSave = employers.find((e) => String(e.id) === form.employerId);
      const tenantDisplay =
        form.ownedBy === 'company' && selectedBranchForSave
          ? (selectedBranchForSave.tradeName || selectedBranchForSave.name || null)
          : form.ownedBy === 'employee' && selectedEmployeeForSave
            ? (selectedEmployeeForSave.name || null)
            : form.ownedBy === 'employer' && selectedEmployerForSave
              ? (selectedEmployerForSave.name || null)
              : form.ownedBy === 'other'
                ? (form.otherPartyName?.trim() || null)
                : null;

      let housingId: number;
      if (isEdit && editHousingId) {
        housingId = editHousingId;
        await api.dbQuery(
          `UPDATE housing_units SET
            name = ?, housingType = ?, ownedBy = ?, emirate = ?, address = ?,
            landlordName = ?, tenantDisplayName = ?, contractNo = ?, contractIssue = ?, contractExpiry = ?,
            rentAmount = ?, paymentMethod = ?, installmentsCount = ?, branchId = ?, employeeId = ?, employerId = ?
          WHERE id = ?`,
          [
            form.name.trim(),
            housingTypeFormToDb(form.housingType),
            form.ownedBy,
            form.emirate || null,
            form.address || null,
            form.landlordName || null,
            tenantDisplay,
            form.contractNo || null,
            form.contractIssue || null,
            form.contractExpiry || null,
            rentAmount,
            form.paymentMethod || null,
            installmentsCount,
            branchId,
            employeeId,
            employerId,
            editHousingId,
          ]
        );
        await api.dbQuery('DELETE FROM housing_installments WHERE housingId = ?', [editHousingId]);
      } else {
        const code = await generateNextCode(
          'RMH',
          'housing_units',
          (sql: string, params?: unknown[]) => api.dbQuery!(sql, params) as Promise<{ success?: boolean; data?: { code?: string }[] }>
        );
        const ins = await api.dbQuery(
          `INSERT INTO housing_units (
            code, name, housingType, ownedBy, emirate, address, landlordName, tenantDisplayName,
            contractNo, contractIssue, contractExpiry, rentAmount, paymentMethod, installmentsCount,
            branchId, employeeId, employerId, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            code,
            form.name.trim(),
            housingTypeFormToDb(form.housingType),
            form.ownedBy,
            form.emirate || null,
            form.address || null,
            form.landlordName || null,
            tenantDisplay,
            form.contractNo || null,
            form.contractIssue || null,
            form.contractExpiry || null,
            rentAmount,
            form.paymentMethod || null,
            installmentsCount,
            branchId,
            employeeId,
            employerId,
          ]
        );
        housingId = ins?.lastInsertId ?? (await api.dbQuery('SELECT id FROM housing_units WHERE code = ?', [code]))?.data?.[0]?.id;
        if (!housingId) throw new Error(t('housing.addModal.unitCreatedFailed'));
      }

      if (form.contractNo && form.leasePaymentType === 'multiple') {
        const validInst = form.leaseInstallments.filter((i) => (parseFloat(i.amount) || 0) > 0 && i.dueDate);
        for (let seq = 0; seq < validInst.length; seq++) {
          const inst = validInst[seq];
          await api.dbQuery(
            'INSERT INTO housing_installments (housingId, seq, amount, dueDate, note) VALUES (?, ?, ?, ?, ?)',
            [housingId, seq, parseFloat(inst.amount), inst.dueDate, inst.note?.trim() || null]
          );
        }
      }

      if (isEdit) await api.dbQuery('DELETE FROM housing_custom_fields WHERE housingUnitId = ?', [housingId]);
      for (const section of customSections) {
        const content = JSON.stringify({
          rows: section.rows.map((r) => ({
            id: r.id,
            key: r.key,
            value: r.value,
            isDate: r.isDate,
            enableAlert: r.enableAlert,
            alertDate: r.alertDate,
            daysBeforeExpiry: r.daysBeforeExpiry ?? 30,
          })),
        });
        const alertRows = section.rows.filter((r) => r.enableAlert && r.isDate && r.value);
        const firstAlert = alertRows.length > 0 ? alertRows.reduce((a, b) => (new Date(b.value) > new Date(a.value) ? b : a)) : undefined;
        await api.dbQuery(
          'INSERT INTO housing_custom_fields (housingUnitId, title, content, enableAlert, alertDate, daysBeforeExpiry) VALUES (?, ?, ?, ?, ?, ?)',
          [
            housingId,
            section.title,
            content,
            firstAlert?.enableAlert ? 1 : 0,
            firstAlert?.value || firstAlert?.alertDate || null,
            firstAlert?.daysBeforeExpiry ?? null,
          ]
        );
      }

      for (const doc of pendingDocs) {
        if (!window.electronAPI?.documentSave) continue;
        const parts = doc.sourcePath.replace(/\\/g, '/').split('/');
        const base = parts[parts.length - 1] || 'file';
        const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
        const name = (doc.customName?.trim() ? doc.customName.trim().replace(/[/\\:*?"<>|]/g, '_') + ext : base);
        const relativePath = `Housing/${housingId}/${doc.sectionKey}/${name}`;
        await window.electronAPI.documentSave({
          sourceFilePath: doc.sourcePath,
          relativePath,
          customName: doc.customName || base,
          entityType: 'housing',
          entityId: housingId,
          section: doc.sectionKey,
        });
      }

      const HOUSING_TRACKED = ['name', 'housingType', 'ownedBy', 'emirate', 'address', 'landlordName', 'tenantDisplayName', 'contractNo', 'contractIssue', 'contractExpiry', 'rentAmount', 'paymentMethod', 'leasePaymentType', 'branchId', 'employeeId', 'employerId', 'otherPartyName'];
      let logDetails: string;
      if (isEdit && oldFormRef.current) {
        logDetails = buildChangeSummary(oldFormRef.current, { ...form }, 'housing', form.name.trim(), HOUSING_TRACKED);
      } else {
        logDetails = `${isEdit ? 'edited' : 'created'}::housing::${form.name.trim()}`;
      }

      await logActivity({
        module: 'housing',
        action: isEdit ? 'edit' : 'create',
        entityType: 'housing',
        entityId: housingId,
        details: logDetails,
        performedByUserId: user?.id,
        performedByUsername: user?.fullName || user?.username,
        performedByUserCode: user?.username,
      });
      toast.success(isEdit ? t('housing.addModal.unitUpdated') : t('housing.addModal.unitAdded'));
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('housing.addModal.saveFailed'));
      toast.error(t('housing.addModal.toastSaveFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = 'w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white';
  const labelClass = 'block text-sm font-medium text-dark-charcoal mb-1';
  const emirateReadOnly = form.ownedBy === 'company' && form.branchId && selectedBranch;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-secondary-gray px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-primary-gold">{isEdit ? t('housing.addModal.editTitle') : t('housing.addModal.addTitle')}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-secondary-gray/30 rounded-lg">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="p-3 bg-alert-red/10 text-alert-red rounded-lg text-sm">{error}</div>}

          <div>
            <label className={labelClass}>{t('housing.addModal.unitNameRequired')}</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder={t('housing.addModal.unitNamePlaceholder')} required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('housing.addModal.useType')}</label>
              <select value={form.housingType} onChange={(e) => setForm({ ...form, housingType: e.target.value })} className={inputClass}>
                {HOUSING_TYPES.map((x) => (
                  <option key={x.value} value={x.value}>{t(`housing.types.${x.value}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('housing.ownedBy')}</label>
              <select
                value={form.ownedBy}
                onChange={(e) => {
                  const v = e.target.value as 'company' | 'employee' | 'employer' | 'other';
                  setForm({
                    ...form,
                    ownedBy: v,
                    branchId: v !== 'company' ? '' : form.branchId,
                    employeeId: v !== 'employee' ? '' : form.employeeId,
                    employerId: v !== 'employer' ? '' : form.employerId,
                    otherPartyName: v !== 'other' ? '' : form.otherPartyName,
                    emirate: v === 'company' && form.branchId && selectedBranch ? selectedBranch.emirate : form.emirate,
                  });
                }}
                className={inputClass}
              >
                {OWNED_BY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(`housing.ownedByOptions.${o.value}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {form.ownedBy === 'company' && (
            <div>
              <label className={labelClass}>{t('housing.addModal.tenantLabel')}</label>
              <select
                value={form.branchId}
                onChange={(e) => {
                  const bid = e.target.value;
                  const br = branches.find((b) => String(b.id) === bid);
                  setForm({
                    ...form,
                    branchId: bid,
                    emirate: br?.emirate || form.emirate,
                  });
                }}
                className={inputClass}
              >
                <option value="">{t('housing.addModal.noOption')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {selectedBranch && (
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {selectedBranch.tradeName && <span className="text-dark-charcoal/80">{t('housing.addModal.tradeName')}: <strong>{selectedBranch.tradeName}</strong></span>}
                  {selectedBranch.emirate && <span className="text-dark-charcoal/80">{t('housing.emirate')}: <strong>{getEmirateLabel(selectedBranch.emirate, lang)}</strong></span>}
                </div>
              )}
            </div>
          )}

          {form.ownedBy === 'employee' && (
            <div>
              <label className={labelClass}>{t('housing.addModal.tenantLabel')}</label>
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder={t('housing.addModal.searchPlaceholder')}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg mb-2"
              />
              <div className="max-h-40 overflow-y-auto border border-secondary-gray rounded-lg">
                {filteredEmployees.length === 0 ? (
                  <p className="p-3 text-secondary-gray text-sm">{t('housing.addModal.noResults')}</p>
                ) : (
                  filteredEmployees.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setForm({ ...form, employeeId: String(e.id) })}
                      className={`w-full text-right px-3 py-2 border-b border-secondary-gray/30 last:border-0 hover:bg-accent-sand/30 ${form.employeeId === String(e.id) ? 'bg-primary-gold/10 text-primary-gold' : ''}`}
                    >
                      {e.name} {e.code && <span className="text-xs text-dark-charcoal/70">({e.code})</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {form.ownedBy === 'employer' && (
            <div>
              <label className={labelClass}>{t('housing.addModal.tenantEmployers')}</label>
              <input
                type="text"
                value={employerSearch}
                onChange={(e) => setEmployerSearch(e.target.value)}
                placeholder={t('housing.addModal.searchPlaceholder')}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg mb-2"
              />
              <div className="max-h-40 overflow-y-auto border border-secondary-gray rounded-lg">
                {filteredEmployers.length === 0 ? (
                  <p className="p-3 text-secondary-gray text-sm">{t('housing.addModal.noResults')}</p>
                ) : (
                  filteredEmployers.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setForm({ ...form, employerId: String(e.id) })}
                      className={`w-full text-right px-3 py-2 border-b border-secondary-gray/30 last:border-0 hover:bg-accent-sand/30 ${form.employerId === String(e.id) ? 'bg-primary-gold/10 text-primary-gold' : ''}`}
                    >
                      {e.name} {e.code && <span className="text-xs text-dark-charcoal/70">({e.code})</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {form.ownedBy === 'other' && (
            <div>
              <label className={labelClass}>{t('housing.addModal.tenantLabel')}</label>
              <input
                type="text"
                value={form.otherPartyName}
                onChange={(e) => setForm({ ...form, otherPartyName: e.target.value })}
                className={inputClass}
                placeholder={t('housing.addModal.optionalPlaceholder')}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>{t('housing.emirate')}</label>
            {emirateReadOnly ? (
              <input type="text" readOnly value={form.emirate ? getEmirateLabel(form.emirate, lang) : ''} className={inputClass + ' bg-gray-100'} />
            ) : (
              <select value={form.emirate} onChange={(e) => setForm({ ...form, emirate: e.target.value })} className={inputClass}>
                <option value="">—</option>
                {UAE_EMIRATES.map((e) => (
                  <option key={e.value} value={e.value}>{getEmirateLabel(e.value, lang)}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelClass}>{t('housing.addModal.addressOptional')}</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} />
          </div>

          <AddHousingLeaseContractSection
            form={form as HousingFormLeaseShape}
            setForm={
              setForm as React.Dispatch<
                React.SetStateAction<import('./AddHousingLeaseContractSection').HousingFormLeaseShape & Record<string, unknown>>
              >
            }
            labelClass={labelClass}
            inputClass={inputClass}
            t={t}
            pendingDocs={pendingDocs}
            setPendingDocs={setPendingDocs}
            setDocModal={setDocModal}
          />

          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary-gold/20">
              <h3 className="text-lg font-bold text-primary-gold">{t('housing.addModal.additionalLicenses')}</h3>
              <button type="button" onClick={addCustomSection} className="flex items-center gap-2 px-4 py-2 bg-primary-gold text-white rounded-lg hover:bg-accent-sand text-sm">
                <Plus size={18} /> {t('housing.addModal.addSection')}
              </button>
            </div>
            {customSections.length === 0 ? (
              <p className="text-secondary-gray text-sm">{t('housing.addModal.noSections')}</p>
            ) : (
              <div className="space-y-6">
                {customSections.map((section) => (
                  <div key={section.id} className="bg-white p-4 rounded-lg border border-secondary-gray">
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="text"
                        placeholder={t('housing.addModal.sectionTitlePlaceholder')}
                        value={section.title}
                        onChange={(e) => updateCustomSection(section.id, 'title', e.target.value)}
                        className="flex-1 px-3 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white mr-2 font-medium"
                      />
                      <button type="button" onClick={() => removeCustomSection(section.id)} className="p-2 text-alert-red hover:bg-alert-red/10 rounded-lg">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {section.rows.map((row) => (
                        <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            placeholder={t('housing.addModal.keyPlaceholder')}
                            value={row.key}
                            onChange={(e) => updateCustomRow(section.id, row.id, 'key', e.target.value)}
                            className="col-span-3 px-3 py-2 border border-secondary-gray rounded-lg text-sm"
                          />
                          {row.isDate ? (
                            <DatePicker value={row.value} onChange={(v) => updateCustomRow(section.id, row.id, 'value', v || '')} placeholder={t('housing.addModal.valuePlaceholder')} className="col-span-4" />
                          ) : (
                            <input
                              type="text"
                              placeholder={t('housing.addModal.valuePlaceholder')}
                              value={row.value}
                              onChange={(e) => updateCustomRow(section.id, row.id, 'value', e.target.value)}
                              className="col-span-4 px-3 py-2 border border-secondary-gray rounded-lg text-sm"
                            />
                          )}
                          <label className="col-span-2 flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={row.isDate} onChange={(e) => updateCustomRow(section.id, row.id, 'isDate', e.target.checked)} className="w-4 h-4 text-primary-gold rounded" />
                            <span className="text-xs text-dark-charcoal/70">{t('housing.addModal.isDate')}</span>
                          </label>
                          {row.isDate && (
                            <label className="col-span-2 flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={row.enableAlert ?? false} onChange={(e) => updateCustomRow(section.id, row.id, 'enableAlert', e.target.checked)} className="w-4 h-4 text-primary-gold rounded" />
                              <span className="text-xs text-dark-charcoal/70">{t('housing.addModal.alert')}</span>
                            </label>
                          )}
                          {row.isDate && row.enableAlert && (
                            <div className="col-span-4 flex items-center gap-2">
                              <span className="text-xs text-dark-charcoal/70 shrink-0">{t('housing.addModal.alertBefore')}:</span>
                              <input
                                type="number"
                                min={1}
                                value={row.daysBeforeExpiry ?? 30}
                                onChange={(e) => updateCustomRow(section.id, row.id, 'daysBeforeExpiry', parseInt(e.target.value, 10) || 30)}
                                className="w-20 px-2 py-1 border border-secondary-gray rounded text-sm"
                              />
                              <span className="text-xs text-dark-charcoal/70">{t('housing.addModal.days')}</span>
                            </div>
                          )}
                          <button type="button" onClick={() => removeCustomRow(section.id, row.id)} className="col-span-1 p-1 text-alert-red hover:bg-alert-red/10 rounded">
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <button type="button" onClick={() => addCustomRow(section.id)} className="flex items-center gap-1 text-sm text-primary-gold hover:underline">
                        <Plus size={14} /> {t('housing.addModal.addRow')}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await window.electronAPI?.fileSelectDocument?.();
                          if (res?.success && res?.filePath) setDocModal({ sectionKey: section.id, sectionLabel: section.title || t('housing.addModal.customSection'), sourcePath: res.filePath, customName: '' });
                          else if (!res?.canceled) toast.error(res?.error || 'فشل اختيار الملف');
                        }}
                        className="flex items-center gap-1 text-sm text-primary-gold hover:underline"
                      >
                        <Upload size={14} /> {t('housing.addModal.addDocuments')}
                      </button>
                    </div>
                    {pendingDocs.filter((d) => d.sectionKey === section.id).map((d, i) => (
                      <span key={`${section.id}-${i}-${d.sourcePath}`} className="inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded mr-2">
                        <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                        <button type="button" onClick={() => setPendingDocs((p) => { const idx = p.indexOf(d); if (idx === -1) return p; return p.filter((_, j) => j !== idx); })} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DocumentNameModal
            open={!!docModal}
            title={t('housing.addModal.addDocTitle')}
            subtitle={docModal ? `${t('housing.addModal.docSectionLabel')}: ${docModal.sectionLabel}` : undefined}
            value={docModal?.customName ?? ''}
            onChange={(v) => setDocModal((m) => (m ? { ...m, customName: v } : null))}
            placeholder={t('housing.addModal.docNameOptional')}
            cancelLabel={t('housing.cancel')}
            confirmLabel={t('employees.addToList')}
            onCancel={() => setDocModal(null)}
            onConfirm={() => {
              if (!docModal) return;
              setPendingDocs((p) => [...p, { ...docModal }]);
              setDocModal(null);
              toast.success(t('housing.addModal.documentWillUpload'));
            }}
          />

          <div className="flex gap-3 pt-4 border-t border-secondary-gray">
            <button type="submit" disabled={loading} className="flex-1 bg-primary-gold text-white py-2.5 rounded-lg hover:bg-accent-sand font-medium disabled:opacity-50">
              {loading ? t('common.saving') : t('common.save')}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-2.5 border border-secondary-gray rounded-lg hover:bg-secondary-gray/30">
              {t('housing.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
