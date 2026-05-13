import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UAE_EMIRATES, UAE_COUNTRY, UAE_COUNTRY_AR } from '../../constants/uae';
import { BRANCH_TYPES, isLicenseLeaseOptional, isOfficeOrWebsite } from '../../constants/branchTypes';
import { getEmirateLabel } from '../../constants/uae';
import { generateNextCode } from '../../utils/entityCode';
import { X, Clock, Plus, Trash2, Upload, FileText } from 'lucide-react';
import { DatePicker } from '../shared/DatePicker';
import toast from 'react-hot-toast';
import { logActivity } from '../../utils/activityLog';
import { buildChangeSummary } from '../../utils/buildChangeSummary';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  canBranchUiTab,
  canBranchFieldView,
  canBranchFieldInTab,
  type BranchProfileTabId,
} from '../../services/branchPermissions';
import { canBranchesSensitiveAction } from '../../services/permissionsService';

interface AddBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When provided, form works in Edit mode */
  editBranchId?: number | null;
}

type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

interface DaySchedule {
  enabled: boolean;
  slots: { from: string; to: string }[];
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

const DAY_KEYS: { key: DayKey; labelKey: string }[] = [
  { key: 'sat', labelKey: 'branches.daySat' },
  { key: 'sun', labelKey: 'branches.daySun' },
  { key: 'mon', labelKey: 'branches.dayMon' },
  { key: 'tue', labelKey: 'branches.dayTue' },
  { key: 'wed', labelKey: 'branches.dayWed' },
  { key: 'thu', labelKey: 'branches.dayThu' },
  { key: 'fri', labelKey: 'branches.dayFri' },
];

const defaultWorkSchedule = (): Record<DayKey, DaySchedule> => {
  const empty: DaySchedule = { enabled: false, slots: [] };
  return {
    sun: { ...empty },
    mon: { ...empty },
    tue: { ...empty },
    wed: { ...empty },
    thu: { ...empty },
    fri: { ...empty },
    sat: { ...empty },
  };
};

const INITIAL_FORM = {
  name: '',
  nameEn: '',
  emirate: '',
  city: '',
  address: '',
  phone: '',
  branchType: 'store',
  linkedBranchId: '' as string | number,
  work24h: false,
  status: 'active',
  licenseNo: '',
  tradeName: '',
  tradeNameEn: '',
  licenseIssueDate: '',
  licenseExpiryDate: '',
  contractNo: '',
  landlordName: '',
  leasePaymentType: 'single' as 'single' | 'multiple',
  rentValue: '',
  leaseInstallments: [] as { id: string; amount: string; dueDate: string; note: string }[],
  leaseIssueDate: '',
  leaseExpiryDate: '',
  isLegalEntity: false,
  laborEstablishmentCardNo: '',
  immigrationCardNo: '',
  immigrationCardIssueDate: '',
  immigrationCardExpiryDate: '',
  googleMapUrl: '',
};

export default function AddBranchModal({ isOpen, onClose, onSuccess, editBranchId }: AddBranchModalProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ar' | 'en';
  const user = useAuthStore((s) => s.user);
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
      },
      docs: {
        tradeLicense: granularFieldBypass || canBranchFieldView(permissions, 'field.documentsTradeLicense.view'),
        lease: granularFieldBypass || canBranchFieldView(permissions, 'field.documentsLease.view'),
      },
    };
  }, [granularFieldBypass, permissions]);

  const canUploadBranchDocs = useMemo(
    () => granularFieldBypass || canBranchesSensitiveAction(permissions, 'uploadBranchDocuments'),
    [granularFieldBypass, permissions]
  );

  const showLicensesTab = canBranchUiTab(permissions, 'licenses');
  const showEntityTab = canBranchUiTab(permissions, 'entity');

  const [form, setForm] = useState(INITIAL_FORM);

  const [workSchedule, setWorkSchedule] = useState<Record<DayKey, DaySchedule>>(defaultWorkSchedule);
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFilename, setImageFilename] = useState<string | null>(null);
  const [pendingDocs, setPendingDocs] = useState<{ sectionKey: string; sectionLabel: string; sourcePath: string; customName: string }[]>([]);
  const [docModal, setDocModal] = useState<{ sectionKey: string; sectionLabel: string; sourcePath: string; customName: string } | null>(null);
  const [physicalBranches, setPhysicalBranches] = useState<{ id: number; name: string; emirate: string; city?: string; address?: string }[]>([]);
  const isEdit = !!editBranchId;
  const isOfficeOrWeb = isOfficeOrWebsite(form.branchType);
  const oldFormRef = useRef<Record<string, unknown> | null>(null);

  const setDayEnabled = (day: DayKey, enabled: boolean) => {
    setWorkSchedule((s) => ({
      ...s,
      [day]: { ...s[day], enabled, slots: enabled && s[day].slots.length === 0 ? [{ from: '09:00', to: '18:00' }] : s[day].slots },
    }));
  };
  const setDaySlot = (day: DayKey, idx: number, field: 'from' | 'to', val: string) => {
    setWorkSchedule((s) => {
      const slots = [...s[day].slots];
      slots[idx] = { ...slots[idx], [field]: val };
      return { ...s, [day]: { ...s[day], slots } };
    });
  };
  const addDaySlot = (day: DayKey) => {
    setWorkSchedule((s) => ({
      ...s,
      [day]: { ...s[day], slots: [...s[day].slots, { from: '16:00', to: '22:00' }] },
    }));
  };
  const removeDaySlot = (day: DayKey, idx: number) => {
    setWorkSchedule((s) => {
      const slots = s[day].slots.filter((_, i) => i !== idx);
      return { ...s, [day]: { ...s[day], slots, enabled: slots.length > 0 } };
    });
  };

  useEffect(() => {
    if (isOpen && !editBranchId) {
      setWorkSchedule(defaultWorkSchedule());
    }
  }, [isOpen, editBranchId]);

  // Load physical branches (store/workshop) for linked branch dropdown
  useEffect(() => {
    const dbQuery = window.electronAPI?.dbQuery;
    if (!isOpen || !dbQuery) return;
    (async () => {
      const res = await dbQuery(
        "SELECT id, name, emirate, city, address FROM branches WHERE branchType IN ('store','workshop') AND status != 'archived' ORDER BY name"
      );
      setPhysicalBranches((res?.data ?? []).map((r: any) => ({ id: r.id, name: r.name, emirate: r.emirate || '', city: r.city, address: r.address })));
    })();
  }, [isOpen]);

  // Load branch data when editing
  useEffect(() => {
    const dbQuery = window.electronAPI?.dbQuery;
    if (!isOpen || !editBranchId || !dbQuery) return;
    (async () => {
      try {
        const [bRes, licRes, leaseRes, instRes, estRes, cfRes] = await Promise.all([
          dbQuery('SELECT * FROM branches WHERE id = ?', [editBranchId]),
          dbQuery('SELECT * FROM branch_licenses WHERE branchId = ? LIMIT 1', [editBranchId]),
          dbQuery('SELECT * FROM branch_leases WHERE branchId = ? LIMIT 1', [editBranchId]),
          dbQuery('SELECT * FROM lease_installments WHERE leaseId = (SELECT id FROM branch_leases WHERE branchId = ? LIMIT 1) ORDER BY seq', [editBranchId]),
          dbQuery('SELECT * FROM branch_establishments WHERE branchId = ? LIMIT 1', [editBranchId]),
          dbQuery('SELECT * FROM branch_custom_fields WHERE branchId = ?', [editBranchId]),
        ]);
        const b = bRes?.success && bRes?.data?.[0] ? bRes.data[0] : null;
        const lic = licRes?.success && licRes?.data?.[0] ? licRes.data[0] : null;
        const lease = leaseRes?.success && leaseRes?.data?.[0] ? leaseRes.data[0] : null;
        const installments = instRes?.success && instRes?.data ? instRes.data : [];
        const est = estRes?.success && estRes?.data?.[0] ? estRes.data[0] : null;
        const cfs = cfRes?.success && cfRes?.data ? cfRes.data : [];
        if (b) {
          let schedule = defaultWorkSchedule();
          try {
            if (b.workTimingSlots?.includes('"_24h"')) {
              schedule = defaultWorkSchedule();
            } else if (b.workTimingSlots?.startsWith('{')) {
              const parsed = JSON.parse(b.workTimingSlots) as Record<string, DaySchedule>;
              const def = defaultWorkSchedule();
              DAY_KEYS.forEach(({ key }) => {
                if (parsed[key] && typeof parsed[key]?.enabled === 'boolean' && Array.isArray(parsed[key]?.slots)) {
                  schedule[key] = parsed[key];
                } else {
                  schedule[key] = def[key];
                }
              });
            }
          } catch {}
          setWorkSchedule(schedule);
          const loadedForm = {
            ...INITIAL_FORM,
            name: b.name || '',
            nameEn: b.nameEn || '',
            emirate: b.emirate || '',
            city: b.city || '',
            address: b.address || '',
            phone: b.phone || '',
            branchType: b.branchType || 'store',
            linkedBranchId: b.attachedToId ?? '',
            work24h: !!b.workTimingSlots?.includes('"_24h"') || false,
            status: b.status || 'active',
            licenseNo: lic?.licenseNo || '',
            tradeName: lic?.tradeName || '',
            tradeNameEn: lic?.tradeNameEn || '',
            licenseIssueDate: lic?.issueDate || '',
            licenseExpiryDate: lic?.expiryDate || '',
            contractNo: lease?.contractNo || '',
            landlordName: lease?.landlordName || '',
            leasePaymentType: installments.length > 0 ? 'multiple' : 'single',
            rentValue: lease?.amount != null ? String(lease.amount) : '',
            leaseInstallments: installments.length > 0
              ? installments.map((i: { id: number; seq: number; amount: number; dueDate?: string; note?: string }) => ({
                  id: `i${i.id}`,
                  amount: String(i.amount),
                  dueDate: i.dueDate ? String(i.dueDate).slice(0, 10) : '',
                  note: i.note || '',
                }))
              : [],
            leaseIssueDate: lease?.issueDate || '',
            leaseExpiryDate: lease?.expiryDate || '',
            isLegalEntity: !!est?.isEnabled,
            laborEstablishmentCardNo: est?.laborEstablishmentCardNo || '',
            immigrationCardNo: est?.immigrationEstablishmentCardNo || '',
            immigrationCardIssueDate: est?.immigrationCardIssueDate || '',
            immigrationCardExpiryDate: est?.immigrationCardExpiryDate || '',
            googleMapUrl: b.googleMapUrl || '',
          };
          setForm({
            ...loadedForm,
            leasePaymentType: loadedForm.leasePaymentType === 'multiple' ? 'multiple' : 'single',
          });
          oldFormRef.current = { ...loadedForm, photoPath: b.photoPath || null };
          const parsedSections: CustomSection[] = [];
          for (const f of cfs) {
            try {
              const content = f.content || '{}';
              const parsed = content.startsWith('{') ? JSON.parse(content) : { rows: [] };
              if (parsed.rows?.length) {
                parsedSections.push({
                  id: String(f.id),
                  title: f.title || '',
                  rows: parsed.rows.map((r: any) => {
                    const isDate = !!r.isDate;
                    const enableAlert = !!r.enableAlert;
                    const value = r.value || '';
                    const alertDate = r.alertDate || '';
                    return {
                      id: r.id || Date.now().toString(),
                      key: r.key || '',
                      value: value || (enableAlert && isDate ? alertDate : ''),
                      isDate,
                      enableAlert,
                      alertDate: alertDate || (enableAlert && isDate ? value : ''),
                      daysBeforeExpiry: r.daysBeforeExpiry ?? 30,
                    };
                  }),
                });
              } else {
                parsedSections.push({
                  id: String(f.id),
                  title: f.title || '',
                  rows: [{ id: '1', key: '', value: f.content || '', isDate: false }],
                });
              }
            } catch {
              parsedSections.push({
                id: String(f.id),
                title: f.title || '',
                rows: [{ id: '1', key: '', value: f.content || '', isDate: false, enableAlert: !!f.enableAlert, alertDate: f.alertDate || '', daysBeforeExpiry: f.daysBeforeExpiry ?? 30 }],
              });
            }
          }
          setCustomSections(parsedSections.length ? parsedSections : []);
          if (b.photoPath && window.electronAPI?.fileGetImageUrl) {
            const img = await window.electronAPI.fileGetImageUrl(b.photoPath);
            if (img.success && img.url) setImagePreview(img.url);
          }
          setImageFilename(null);
        }
      } catch (e) {
        console.error('Load branch for edit:', e);
      }
    })();
  }, [isOpen, editBranchId]);

  const handleImageSelect = async () => {
    try {
      if (window.electronAPI?.fileSelectImage) {
        const result = await window.electronAPI.fileSelectImage();
        if (result.success && result.base64Data && result.filename) {
          setImagePreview(result.base64Data);
          setImageFilename(result.filename);
        }
      }
    } catch (err) {
      console.error('Error selecting image:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.contractNo && form.leasePaymentType === 'multiple') {
      const validInst = form.leaseInstallments.filter((i) => (parseFloat(i.amount) || 0) > 0 && i.dueDate);
      const total = validInst.reduce((s, i) => s + parseFloat(i.amount), 0);
      if (validInst.length === 0 || total <= 0) {
        setError(t('branches.addModalErrorInstallment'));
        return;
      }
    }

    if (form.contractNo && form.leasePaymentType === 'single' && !form.rentValue) {
      setError(t('branches.addModalErrorContractValue'));
      return;
    }
    if (isOfficeOrWebsite(form.branchType) && !form.linkedBranchId) {
      setError(t('branches.addModalErrorLinkedBranch'));
      return;
    }

    setLoading(true);
    try {
      if (window.electronAPI?.dbQuery) {
        // Save image if selected
        let imagePath = null;
        if (imagePreview && imageFilename && window.electronAPI.fileSaveImage) {
          const timestamp = Date.now();
          const ext = imageFilename.split('.').pop() || 'jpg';
          const savedFilename = `branch_${timestamp}.${ext}`;
          const saveResult = await window.electronAPI.fileSaveImage(imagePreview, savedFilename);
          if (!saveResult?.success) {
            const msg = saveResult?.error || t('branches.addModalErrorConnection');
            setError(t('branches.addModalErrorDb', { msg }));
            setLoading(false);
            return;
          }
          if (saveResult.relativePath) {
            imagePath = saveResult.relativePath;
          } else if (saveResult.fullPath) {
            imagePath = saveResult.fullPath;
          }
        }

        const workTimingSlots = form.work24h ? '{"_24h":true}' : JSON.stringify(workSchedule);

        let branchId: number;
        const emirateVal = isOfficeOrWeb && form.linkedBranchId ? form.emirate : form.emirate;
        const cityVal = isOfficeOrWeb && form.linkedBranchId ? form.city : form.city;
        const addressVal = isOfficeOrWeb && form.linkedBranchId ? form.address : form.address;
        const cityValue = (cityVal || '').trim() || emirateVal || null;
        const linkedId = isOfficeOrWeb && form.linkedBranchId ? Number(form.linkedBranchId) : null;
        if (isEdit && editBranchId) {
          const updateParams: (string | null | number)[] = [
            form.name,
            form.nameEn || null,
            form.phone || null,
            UAE_COUNTRY,
            emirateVal,
            cityValue,
            addressVal || null,
            form.branchType,
            form.status,
            workTimingSlots,
            linkedId,
            form.googleMapUrl || null,
          ];
          const setPhoto = imagePath != null;
          const updateResult = await window.electronAPI.dbQuery(
            `UPDATE branches SET name=?, nameEn=?, phone=?, country=?, emirate=?, city=?, address=?, branchType=?, status=?, workTimingSlots=?, attachedToId=?, googleMapUrl=?${setPhoto ? ', photoPath=?' : ''} WHERE id=?`,
            setPhoto ? [...updateParams, imagePath, editBranchId] : [...updateParams, editBranchId]
          );
          if (!updateResult?.success) {
            const errorMsg = updateResult?.error || t('branches.addModalErrorUpdate');
            setError(t('branches.addModalErrorDb', { msg: errorMsg }));
            setLoading(false);
            return;
          }
          branchId = editBranchId;
        } else {
          const branchCode = await generateNextCode('RMB', 'branches', (sql, params) =>
            window.electronAPI!.dbQuery!(sql, params)
          );
          const branchResult = await window.electronAPI.dbQuery(
            `INSERT INTO branches (code, name, nameEn, phone, country, emirate, city, address, branchType, status, photoPath, workTimingSlots, attachedToId, googleMapUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              branchCode,
              form.name,
              form.nameEn || null,
              form.phone || null,
              UAE_COUNTRY,
              emirateVal,
              cityValue,
              addressVal || null,
              form.branchType,
              form.status,
              imagePath,
              workTimingSlots,
              linkedId,
              form.googleMapUrl || null,
            ]
          );

          if (!branchResult?.success) {
            const errorMsg = branchResult?.error || t('branches.addModalErrorAdd');
            setError(t('branches.addModalErrorDb', { msg: errorMsg }));
            setLoading(false);
            return;
          }
          branchId = branchResult.lastInsertId ?? 0;
          if (!branchId) {
            const checkResult = await window.electronAPI.dbQuery(
              'SELECT id FROM branches WHERE name = ? ORDER BY id DESC LIMIT 1',
              [form.name]
            );
            branchId = checkResult?.data?.[0]?.id;
            if (!branchId) {
              setError(t('branches.addModalErrorBranchId'));
              setLoading(false);
              return;
            }
          }
        }

        if (isEdit && !isOfficeOrWeb) {
          const [lic, lease, est] = await Promise.all([
            window.electronAPI.dbQuery('SELECT id FROM branch_licenses WHERE branchId = ? LIMIT 1', [branchId]),
            window.electronAPI.dbQuery('SELECT id FROM branch_leases WHERE branchId = ? LIMIT 1', [branchId]),
            window.electronAPI.dbQuery('SELECT id FROM branch_establishments WHERE branchId = ? LIMIT 1', [branchId]),
          ]);
          if (form.licenseNo || form.tradeName || form.tradeNameEn) {
            if (lic?.data?.[0]?.id) {
              await window.electronAPI.dbQuery(
                'UPDATE branch_licenses SET licenseNo=?, tradeName=?, tradeNameEn=?, issueDate=?, expiryDate=? WHERE branchId=?',
                [form.licenseNo || null, form.tradeName || form.name, form.tradeNameEn || null, form.licenseIssueDate || null, form.licenseExpiryDate || null, branchId]
              );
            } else {
              await window.electronAPI.dbQuery(
                'INSERT INTO branch_licenses (branchId, licenseNo, tradeName, tradeNameEn, issueDate, expiryDate) VALUES (?,?,?,?,?,?)',
                [branchId, form.licenseNo || null, form.tradeName || form.name, form.tradeNameEn || null, form.licenseIssueDate || null, form.licenseExpiryDate || null]
              );
            }
          }
          let leaseId: number | null = null;
          if (form.contractNo || form.rentValue || form.landlordName || form.leaseInstallments.length > 0) {
            const leaseAmount = form.leasePaymentType === 'single'
              ? (form.rentValue ? parseFloat(form.rentValue) : null)
              : form.leaseInstallments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) || null;
            if (lease?.data?.[0]?.id) {
              leaseId = lease.data[0].id;
              await window.electronAPI.dbQuery(
                'UPDATE branch_leases SET contractNo=?, landlordName=?, amount=?, issueDate=?, expiryDate=? WHERE branchId=?',
                [form.contractNo || null, form.landlordName || null, leaseAmount, form.leaseIssueDate || null, form.leaseExpiryDate || null, branchId]
              );
            } else {
              const leaseIns = await window.electronAPI.dbQuery(
                'INSERT INTO branch_leases (branchId, contractNo, landlordName, amount, issueDate, expiryDate) VALUES (?,?,?,?,?,?)',
                [branchId, form.contractNo || null, form.landlordName || null, leaseAmount, form.leaseIssueDate || null, form.leaseExpiryDate || null]
              );
              leaseId = leaseIns?.lastInsertId ?? null;
              if (!leaseId) {
                const lr = await window.electronAPI.dbQuery('SELECT id FROM branch_leases WHERE branchId = ? LIMIT 1', [branchId]);
                leaseId = lr?.data?.[0]?.id ?? null;
              }
            }
            if (form.leasePaymentType === 'multiple' && leaseId && form.leaseInstallments.length > 0) {
              await window.electronAPI.dbQuery('DELETE FROM lease_installments WHERE leaseId = ?', [leaseId]);
              const validInst = form.leaseInstallments.filter((i) => (parseFloat(i.amount) || 0) > 0 && i.dueDate);
              for (let seq = 0; seq < validInst.length; seq++) {
                const inst = validInst[seq];
                await window.electronAPI.dbQuery(
                  'INSERT INTO lease_installments (leaseId, seq, amount, dueDate, note) VALUES (?,?,?,?,?)',
                  [leaseId, seq, parseFloat(inst.amount), inst.dueDate, inst.note?.trim() || null]
                );
              }
            } else if (leaseId && form.leasePaymentType === 'single') {
              await window.electronAPI.dbQuery('DELETE FROM lease_installments WHERE leaseId = ?', [leaseId]);
            }
          }
          if (form.isLegalEntity) {
            const upParams = [form.laborEstablishmentCardNo || null, form.immigrationCardNo || null, form.immigrationCardIssueDate || null, form.immigrationCardExpiryDate || null, branchId];
            const upRes = await window.electronAPI.dbQuery(
              'UPDATE branch_establishments SET isEnabled=1, laborEstablishmentCardNo=?, immigrationEstablishmentCardNo=?, immigrationCardIssueDate=?, immigrationCardExpiryDate=? WHERE branchId=?',
              upParams
            );
            if (!upRes?.success) {
              setError(t('branches.addModalErrorEstablishmentUpdate'));
              setLoading(false);
              return;
            }
            const hasEst = est?.data?.[0] != null;
            if (!hasEst) {
              const insRes = await window.electronAPI.dbQuery(
                'INSERT OR IGNORE INTO branch_establishments (branchId, isEnabled, laborEstablishmentCardNo, immigrationEstablishmentCardNo, immigrationCardIssueDate, immigrationCardExpiryDate) VALUES (?,1,?,?,?,?)',
                [branchId, form.laborEstablishmentCardNo || null, form.immigrationCardNo || null, form.immigrationCardIssueDate || null, form.immigrationCardExpiryDate || null]
              );
              if (!insRes?.success) {
                const up2 = await window.electronAPI.dbQuery(
                  'UPDATE branch_establishments SET isEnabled=1, laborEstablishmentCardNo=?, immigrationEstablishmentCardNo=?, immigrationCardIssueDate=?, immigrationCardExpiryDate=? WHERE branchId=?',
                  upParams
                );
                if (!up2?.success) {
                setError(t('branches.addModalErrorEstablishmentEnable'));
                setLoading(false);
                return;
              }
            }
          }
          } else if (est?.data?.[0]?.id) {
            await window.electronAPI.dbQuery(
              'UPDATE branch_establishments SET isEnabled=0 WHERE branchId=?',
              [branchId]
            );
          }
        }
        if (isEdit) {
          await window.electronAPI.dbQuery('DELETE FROM branch_custom_fields WHERE branchId = ?', [branchId]);
        } else if (!isOfficeOrWeb) {
          if (form.licenseNo || form.tradeName || form.tradeNameEn) {
            await window.electronAPI.dbQuery(
              'INSERT INTO branch_licenses (branchId, licenseNo, tradeName, tradeNameEn, issueDate, expiryDate) VALUES (?,?,?,?,?,?)',
              [branchId, form.licenseNo || null, form.tradeName || form.name, form.tradeNameEn || null, form.licenseIssueDate || null, form.licenseExpiryDate || null]
            );
          }
          if (form.contractNo || form.rentValue || form.landlordName || form.leaseInstallments.length > 0) {
            const leaseAmount = form.leasePaymentType === 'single'
              ? (form.rentValue ? parseFloat(form.rentValue) : null)
              : form.leaseInstallments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) || null;
            const leaseIns = await window.electronAPI.dbQuery(
              'INSERT INTO branch_leases (branchId, contractNo, landlordName, amount, issueDate, expiryDate) VALUES (?,?,?,?,?,?)',
              [branchId, form.contractNo || null, form.landlordName || null, leaseAmount, form.leaseIssueDate || null, form.leaseExpiryDate || null]
            );
            const leaseId = leaseIns?.lastInsertId ?? (await window.electronAPI.dbQuery('SELECT id FROM branch_leases WHERE branchId = ? LIMIT 1', [branchId]))?.data?.[0]?.id;
            if (form.leasePaymentType === 'multiple' && leaseId && form.leaseInstallments.length > 0) {
              const validInst = form.leaseInstallments.filter((i) => (parseFloat(i.amount) || 0) > 0 && i.dueDate);
              for (let seq = 0; seq < validInst.length; seq++) {
                const inst = validInst[seq];
                await window.electronAPI.dbQuery(
                  'INSERT INTO lease_installments (leaseId, seq, amount, dueDate, note) VALUES (?,?,?,?,?)',
                  [leaseId, seq, parseFloat(inst.amount), inst.dueDate, inst.note?.trim() || null]
                );
              }
            }
          }
          if (form.isLegalEntity) {
            await window.electronAPI.dbQuery(
              'INSERT INTO branch_establishments (branchId, isEnabled, laborEstablishmentCardNo, immigrationEstablishmentCardNo, immigrationCardIssueDate, immigrationCardExpiryDate) VALUES (?,1,?,?,?,?)',
              [branchId, form.laborEstablishmentCardNo || null, form.immigrationCardNo || null, form.immigrationCardIssueDate || null, form.immigrationCardExpiryDate || null]
            );
          }
        }

        for (const section of customSections) {
          const content = JSON.stringify({ rows: section.rows });
          const alertRows = section.rows.filter((r) => r.enableAlert && r.isDate && r.value);
          const firstAlertRow = alertRows.length > 0
            ? alertRows.reduce((a, b) => (new Date(b.value) > new Date(a.value) ? b : a))
            : undefined;
          const alertDate = firstAlertRow ? (firstAlertRow.value || firstAlertRow.alertDate || null) : null;
          await window.electronAPI.dbQuery(
            'INSERT INTO branch_custom_fields (branchId, title, content, enableAlert, alertDate, daysBeforeExpiry) VALUES (?,?,?,?,?,?)',
            [branchId, section.title, content, firstAlertRow?.enableAlert ? 1 : 0, alertDate, firstAlertRow?.daysBeforeExpiry ?? null]
          );
        }

        const BRANCH_TRACKED = [
          'name', 'nameEn', 'phone', 'emirate', 'city', 'address', 'branchType',
          'linkedBranchId', 'status', 'googleMapUrl', 'photoPath',
          'licenseNo', 'tradeName', 'tradeNameEn', 'licenseIssueDate', 'licenseExpiryDate',
          'contractNo', 'landlordName', 'rentValue', 'leaseIssueDate', 'leaseExpiryDate',
          'isLegalEntity', 'laborEstablishmentCardNo', 'immigrationCardNo',
          'immigrationCardIssueDate', 'immigrationCardExpiryDate',
        ];
        let logDetails: string;
        if (isEdit && oldFormRef.current) {
          logDetails = buildChangeSummary(oldFormRef.current, { ...form }, 'branch', form.name, BRANCH_TRACKED);
        } else {
          logDetails = `${isEdit ? 'edited' : 'created'}::branch::${form.name}`;
        }
        await logActivity({
          module: 'branch',
          action: isEdit ? 'edit' : 'create',
          entityType: 'branch',
          entityId: branchId,
          details: logDetails,
          performedByUserId: user?.id,
          performedByUsername: user?.fullName || user?.username,
          performedByUserCode: user?.username,
        });

        if (window.electronAPI?.notificationsEnsureLeaseReminders) {
          await window.electronAPI.notificationsEnsureLeaseReminders();
        }
        for (const doc of pendingDocs) {
          if (!window.electronAPI?.documentSave) continue;
          const parts = doc.sourcePath.replace(/\\/g, '/').split('/');
          const base = parts[parts.length - 1] || 'file';
          const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
          const name = (doc.customName && doc.customName.trim())
            ? doc.customName.trim().replace(/[/\\:*?"<>|]/g, '_') + ext
            : base;
          const relativePath = `Branches/${branchId}/${doc.sectionKey}/${name}`;
          const res = await window.electronAPI.documentSave({
            sourceFilePath: doc.sourcePath,
            relativePath,
            customName: doc.customName || base,
            entityType: 'branch',
            entityId: branchId,
            section: doc.sectionKey,
          });
          if (!res?.success) toast.error(`${t('branches.addModalDocUploadFailed')}: ${res?.error || ''}`);
        }
        setPendingDocs([]);
        onSuccess();
        setForm(INITIAL_FORM);
        setWorkSchedule(defaultWorkSchedule());
        setCustomSections([]);
        setImagePreview(null);
        setImageFilename(null);
        onClose();
      } else {
        setError(t('branches.addModalErrorConnection'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const addCustomSection = () => {
    setCustomSections([
      ...customSections,
      { id: Date.now().toString(), title: '', rows: [{ id: 'r1', key: '', value: '', isDate: false }] },
    ]);
  };

  const removeCustomSection = (id: string) => {
    setCustomSections(customSections.filter((s) => s.id !== id));
  };

  const updateCustomSection = (id: string, field: 'title', value: string) => {
    setCustomSections(customSections.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const addCustomRow = (sectionId: string) => {
    setCustomSections(
      customSections.map((s) =>
        s.id === sectionId ? { ...s, rows: [...s.rows, { id: `r${Date.now()}`, key: '', value: '', isDate: false }] } : s
      )
    );
  };

  const removeCustomRow = (sectionId: string, rowId: string) => {
    setCustomSections(
      customSections.map((s) =>
        s.id === sectionId ? { ...s, rows: s.rows.filter((r) => r.id !== rowId) } : s
      )
    );
  };

  const updateCustomRow = (sectionId: string, rowId: string, field: keyof CustomRow, value: unknown) => {
    setCustomSections(
      customSections.map((s) => {
        if (s.id !== sectionId) return s;
        if (field === 'enableAlert' && value === true) {
          return {
            ...s,
            rows: s.rows.map((r) =>
              r.id === rowId ? { ...r, enableAlert: true, alertDate: r.value || r.alertDate || '' } : { ...r, enableAlert: false }
            ),
          };
        }
        return {
          ...s,
          rows: s.rows.map((r) => {
            if (r.id !== rowId) return r;
            const updated = { ...r, [field]: value };
            if (field === 'value' && r.enableAlert && r.isDate) updated.alertDate = value as string;
            return updated;
          }),
        };
      })
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto flex flex-col">
        {/* Header - موحد مع نموذج الموظف */}
        <div className="sticky top-0 bg-primary-gold text-white p-6 flex items-center justify-between z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold">{isEdit ? t('branches.addModalTitleEdit') : t('branches.addModalTitleAdd')}</h2>
            <p className="text-sm opacity-90 mt-1">{lang === 'ar' ? UAE_COUNTRY_AR : UAE_COUNTRY}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 bg-alert-red/10 border border-alert-red text-alert-red rounded-lg">
              {error}
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <h3 className="text-lg font-bold text-primary-gold mb-4 pb-2 border-b border-primary-gold/20">
              {t('branches.addModalBasicInfo')}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-charcoal mb-1">
                    {t('branches.addModalName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-charcoal mb-1">
                    {t('branches.addModalNameEn')}
                  </label>
                  <input
                    type="text"
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                  />
                </div>
              </div>

              {branchPerm.basic.photo && (
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-2">
                  {t('branches.addModalBranchPhoto')}
                </label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Branch preview"
                        className="w-32 h-32 object-cover rounded-lg border border-secondary-gray"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setImageFilename(null);
                        }}
                        className="absolute -top-2 -right-2 bg-alert-red text-white rounded-full p-1 hover:bg-alert-red/80"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleImageSelect}
                      className="px-4 py-2 border-2 border-dashed border-secondary-gray rounded-lg hover:border-primary-gold hover:bg-primary-gold/5 transition-colors text-sm font-medium text-dark-charcoal"
                    >
                      + {t('branches.addModalUploadPhoto')}
                    </button>
                  )}
                </div>
              </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {branchPerm.basic.typeStatus && (
                <div>
                  <label className="block text-sm font-medium text-dark-charcoal mb-1">
                    {t('branches.addModalType')}
                  </label>
                  <select
                    required
                    value={form.branchType}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, branchType: v, linkedBranchId: isOfficeOrWebsite(v) ? form.linkedBranchId : '' });
                    }}
                    className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                  >
                    {BRANCH_TYPES.map((bt) => (
                      <option key={bt.value} value={bt.value}>{t(`branches.${bt.value}`)}</option>
                    ))}
                  </select>
                </div>
                )}
                {isOfficeOrWeb ? (
                  branchPerm.basic.linked && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-dark-charcoal mb-1">
                      {t('branches.addModalLinkedBranchRequired')}
                    </label>
                    <select
                      required
                      value={form.linkedBranchId}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : '';
                        const lb = physicalBranches.find((b) => b.id === id);
                        setForm({
                          ...form,
                          linkedBranchId: id,
                          emirate: lb?.emirate ?? '',
                          city: lb?.city ?? '',
                          address: lb?.address ?? '',
                        });
                      }}
                      className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                    >
                      <option value="">{t('branches.addModalChooseLinkedBranch')}</option>
                      {physicalBranches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  )
                ) : (
                  <>
                    {branchPerm.basic.location && (
                    <>
                    <div>
                      <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('branches.addModalEmirate')}</label>
                      <select
                        required
                        value={form.emirate}
                        onChange={(e) => setForm({ ...form, emirate: e.target.value })}
                        className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                      >
                        <option value="">{t('branches.addModalChooseEmirate')}</option>
                        {UAE_EMIRATES.map((e) => (
                          <option key={e.value} value={e.value}>{getEmirateLabel(e.value, lang)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('branches.addModalCity')}</label>
                      <input
                        type="text"
                        placeholder={t('branches.addModalCityPlaceholder')}
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                      />
                    </div>
                    </>
                    )}
                  </>
                )}
                {branchPerm.basic.contact && (
                <div>
                  <label className="block text-sm font-medium text-dark-charcoal mb-1">
                    {t('branches.addModalPhone')}
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                  />
                </div>
                )}
              </div>

              {!isOfficeOrWeb && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branchPerm.basic.address && (
                  <div>
                    <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('branches.addModalAddressDetail')}</label>
                    <textarea
                      rows={3}
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                    />
                  </div>
                  )}
                  {branchPerm.basic.map && (
                  <div>
                    <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('branches.addModalGoogleMap')}</label>
                    <textarea
                      rows={3}
                      dir="ltr"
                      placeholder={t('branches.addModalGoogleMapPlaceholder')}
                      value={form.googleMapUrl}
                      onChange={(e) => setForm({ ...form, googleMapUrl: e.target.value })}
                      className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white text-left"
                    />
                  </div>
                  )}
                </div>
              )}

              {branchPerm.basic.typeStatus && (
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {t('branches.addModalStatus')}
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                >
                  <option value="active">{t('branches.addModalStatusActive')}</option>
                  <option value="suspended">{t('branches.addModalStatusSuspended')}</option>
                </select>
              </div>
              )}

              {isOfficeOrWeb && branchPerm.basic.schedule && (
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.work24h}
                      onChange={(e) => setForm({ ...form, work24h: e.target.checked })}
                      className="w-4 h-4 text-primary-gold rounded"
                    />
                    <span className="text-sm font-medium text-dark-charcoal">{t('branches.addModal24hLabel')}</span>
                  </label>
                </div>
              )}
              {/* Daily Scheduler */}
              {branchPerm.basic.schedule && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-charcoal mb-3 flex items-center gap-2">
                  <Clock size={18} /> {t('branches.addModalWorkSchedule')} {isOfficeOrWeb && form.work24h && <span className="text-primary-gold">(24h)</span>}
                </label>
                <div className={`space-y-3 border border-secondary-gray rounded-lg p-4 bg-white ${isOfficeOrWeb && form.work24h ? 'opacity-60 pointer-events-none' : ''}`}>
                  {DAY_KEYS.map(({ key, labelKey }) => (
                    <div key={key} className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 w-24 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={workSchedule[key]?.enabled ?? false}
                          onChange={(e) => setDayEnabled(key, e.target.checked)}
                          className="w-4 h-4 text-primary-gold rounded"
                        />
                        <span className="text-sm font-medium">{t(labelKey)}</span>
                      </label>
                      {(workSchedule[key]?.enabled ?? false) && (
                        <div className="flex flex-wrap items-center gap-2">
                          {(workSchedule[key]?.slots ?? []).map((slot, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <input
                                type="time"
                                value={slot.from}
                                onChange={(e) => setDaySlot(key, idx, 'from', e.target.value)}
                                className="px-2 py-1 border border-secondary-gray rounded text-sm"
                              />
                              <span className="text-dark-charcoal/60">–</span>
                              <input
                                type="time"
                                value={slot.to}
                                onChange={(e) => setDaySlot(key, idx, 'to', e.target.value)}
                                className="px-2 py-1 border border-secondary-gray rounded text-sm"
                              />
                              {(workSchedule[key]?.slots ?? []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeDaySlot(key, idx)}
                                  className="p-1 text-alert-red hover:bg-alert-red/10 rounded"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addDaySlot(key)}
                            className="flex items-center gap-1 px-2 py-1 text-primary-gold hover:bg-primary-gold/10 rounded text-sm"
                          >
                            <Plus size={14} /> {t('branches.addModalSecondSlot')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>
          </div>

          {/* Section 2: Trade License Info — مخفي للمكتب والموقع الإلكتروني */}
          {!isOfficeOrWeb && showLicensesTab && branchPerm.licenses.trade && (
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <h3 className="text-lg font-bold text-primary-gold mb-4 pb-2 border-b border-primary-gold/20">
              {t('branches.addModalLicenseSection')} {isLicenseLeaseOptional(form.branchType) && <span className="text-sm font-normal text-dark-charcoal/60">({t('branches.addModalOptional')})</span>}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {t('branches.addModalLicenseNo')}
                </label>
                <input
                  type="text"
                  value={form.licenseNo}
                  onChange={(e) => setForm({ ...form, licenseNo: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {t('branches.addModalTradeNameAr')}
                </label>
                <input
                  type="text"
                  value={form.tradeName}
                  onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {t('branches.addModalTradeNameEn')}
                </label>
                <input
                  type="text"
                  value={form.tradeNameEn}
                  onChange={(e) => setForm({ ...form, tradeNameEn: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {t('branches.addModalIssueDate')}
                </label>
                <DatePicker value={form.licenseIssueDate} onChange={(v) => setForm({ ...form, licenseIssueDate: v })} placeholder={t('branches.leaseModalChooseDate')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {t('branches.addModalExpiryDate')}
                </label>
                <DatePicker value={form.licenseExpiryDate} onChange={(v) => setForm({ ...form, licenseExpiryDate: v })} placeholder={t('branches.leaseModalChooseDate')} />
              </div>
            </div>
            {canUploadBranchDocs && branchPerm.docs.tradeLicense && (
            <div className="mt-3">
              <button
                type="button"
                onClick={async () => {
                  const res = await window.electronAPI?.fileSelectDocument?.();
                  if (res?.success && res?.filePath) setDocModal({ sectionKey: 'trade_license', sectionLabel: t('branches.addModalLicenseSection'), sourcePath: res.filePath, customName: '' });
                  else if (!res?.canceled) toast.error(res?.error || t('branches.addModalErrorConnection'));
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm"
              >
                <Upload size={16} /> {t('branches.addModalAddDocs')}
              </button>
              {pendingDocs.map((d, i) => d.sectionKey === 'trade_license' ? (
                <span key={i} className="mr-2 inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                  <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                  <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                </span>
              ) : null)}
            </div>
            )}
          </div>
          )}

          {/* Section 3: Lease Info — مخفي للمكتب والموقع الإلكتروني */}
          {!isOfficeOrWeb &&
            showLicensesTab &&
            (branchPerm.licenses.leaseMeta ||
              branchPerm.licenses.leaseTotal ||
              branchPerm.licenses.leaseSchedule ||
              branchPerm.licenses.leaseInstAmounts) && (
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <h3 className="text-lg font-bold text-primary-gold mb-4 pb-2 border-b border-primary-gold/20">
              {t('branches.addModalLeaseSection')} {isLicenseLeaseOptional(form.branchType) && <span className="text-sm font-normal text-dark-charcoal/60">({t('branches.addModalOptional')})</span>}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {branchPerm.licenses.leaseMeta && (
              <>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('branches.addModalContractNo')}</label>
                <input
                  type="text"
                  value={form.contractNo}
                  onChange={(e) => setForm({ ...form, contractNo: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('branches.addModalLandlordName')}</label>
                <input
                  type="text"
                  value={form.landlordName}
                  onChange={(e) => setForm({ ...form, landlordName: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                />
              </div>
              </>
              )}
                {(branchPerm.licenses.leaseSchedule || branchPerm.licenses.leaseInstAmounts) && (
                  <div>
                    <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('branches.addModalPaymentType')}</label>
                    <select
                      value={form.leasePaymentType}
                      onChange={(e) => setForm({
                        ...form,
                        leasePaymentType: e.target.value as 'single' | 'multiple',
                        leaseInstallments: e.target.value === 'multiple' && form.leaseInstallments.length === 0
                          ? [{ id: `i${Date.now()}`, amount: '', dueDate: '', note: '' }]
                          : form.leaseInstallments,
                      })}
                      className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                    >
                      <option value="single">{t('branches.leaseModalSingle')}</option>
                      <option value="multiple">{t('branches.leaseModalMultiple')}</option>
                    </select>
                  </div>
                )}
              {branchPerm.licenses.leaseTotal &&
              (branchPerm.licenses.leaseSchedule || branchPerm.licenses.leaseInstAmounts
                ? form.leasePaymentType === 'single'
                : true) ? (
                <div>
                  <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('branches.addModalContractValue')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.rentValue}
                    onChange={(e) => setForm({ ...form, rentValue: e.target.value })}
                    className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                  />
                </div>
              ) : null}
              {branchPerm.licenses.leaseSchedule && form.leasePaymentType === 'multiple' ? (
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-dark-charcoal">{t('branches.addModalInstallments')}</span>
                    <button
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        leaseInstallments: [...form.leaseInstallments, { id: `i${Date.now()}`, amount: '', dueDate: '', note: '' }],
                      })}
                      className="flex items-center gap-1 text-sm text-primary-gold hover:underline"
                    >
                      <Plus size={14} />
                      {t('branches.addModalAddInstallment')}
                    </button>
                  </div>
                  <div className="space-y-2 border border-secondary-gray rounded-lg p-3 bg-white">
                    {form.leaseInstallments.map((inst, idx) => (
                      <div key={inst.id} className="flex flex-wrap items-center gap-3">
                        <span className="text-sm text-dark-charcoal/70 w-20 shrink-0">#{idx + 1}</span>
                        {branchPerm.licenses.leaseInstAmounts ? (
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t('branches.leaseModalAmount')}
                            value={inst.amount}
                            onChange={(e) => setForm({
                              ...form,
                              leaseInstallments: form.leaseInstallments.map((x) =>
                                x.id === inst.id ? { ...x, amount: e.target.value } : x
                              ),
                            })}
                            className="flex-1 min-w-[100px] px-3 py-2 border border-secondary-gray rounded-lg text-sm"
                          />
                        ) : (
                          <span className="flex-1 min-w-[100px] text-sm text-dark-charcoal/50 py-2">—</span>
                        )}
                        <DatePicker
                          value={inst.dueDate}
                          onChange={(v) => setForm({
                            ...form,
                            leaseInstallments: form.leaseInstallments.map((x) =>
                              x.id === inst.id ? { ...x, dueDate: v } : x
                            ),
                          })}
                          placeholder={t('branches.leaseModalDueDate')}
                          className="flex-1 min-w-[140px]"
                        />
                        <input
                          type="text"
                          placeholder={t('branches.leaseModalNoteOptional')}
                          value={inst.note ?? ''}
                          onChange={(e) => setForm({
                            ...form,
                            leaseInstallments: form.leaseInstallments.map((x) =>
                              x.id === inst.id ? { ...x, note: e.target.value } : x
                            ),
                          })}
                          className="flex-1 min-w-[120px] px-3 py-2 border border-secondary-gray rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setForm({
                            ...form,
                            leaseInstallments: form.leaseInstallments.filter((x) => x.id !== inst.id),
                          })}
                          className="p-1 text-alert-red hover:bg-alert-red/10 rounded shrink-0"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {branchPerm.licenses.leaseInstAmounts && (
                  <p className="text-sm text-dark-charcoal/70 mt-2">
                    {t('branches.addModalTotalContractValue')} <strong>{(() => {
                      const total = form.leaseInstallments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                      return total.toLocaleString('en', { minimumFractionDigits: 0 }) + ' ' + t('branches.leaseModalAed');
                    })()}</strong>
                  </p>
                  )}
                </div>
              ) : null}
              {branchPerm.licenses.leaseMeta && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('branches.addModalLeaseIssueDate')}</label>
                  <DatePicker value={form.leaseIssueDate} onChange={(v) => setForm({ ...form, leaseIssueDate: v })} placeholder={t('branches.leaseModalChooseDate')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('branches.addModalLeaseExpiryDate')}</label>
                  <DatePicker value={form.leaseExpiryDate} onChange={(v) => setForm({ ...form, leaseExpiryDate: v })} placeholder={t('branches.leaseModalChooseDate')} />
                </div>
              </div>
              )}
            </div>
            {canUploadBranchDocs && branchPerm.docs.lease && (
            <div className="mt-3">
              <button
                type="button"
                onClick={async () => {
                  const res = await window.electronAPI?.fileSelectDocument?.();
                  if (res?.success && res?.filePath) setDocModal({ sectionKey: 'lease', sectionLabel: t('branches.addModalLeaseSection'), sourcePath: res.filePath, customName: '' });
                  else if (!res?.canceled) toast.error(res?.error || t('branches.addModalErrorConnection'));
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm"
              >
                <Upload size={16} /> {t('branches.addModalAddDocs')}
              </button>
              {pendingDocs.map((d, i) => d.sectionKey === 'lease' ? (
                <span key={i} className="mr-2 inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                  <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                  <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                </span>
              ) : null)}
            </div>
            )}
          </div>
          )}

          {/* Section 4: Legal Entity Toggle — مخفي للمكتب والموقع الإلكتروني */}
          {!isOfficeOrWeb && showEntityTab && branchPerm.entity.info && (
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary-gold/20">
              <h3 className="text-lg font-bold text-primary-gold">
                {t('branches.addModalEstablishmentToggle')}
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isLegalEntity}
                  onChange={(e) => setForm({ ...form, isLegalEntity: e.target.checked })}
                  className="w-5 h-5 text-primary-gold rounded focus:ring-primary-gold"
                />
                <span className="text-sm font-medium text-dark-charcoal">
                  {t('branches.addModalEstablishmentDesc')}
                </span>
              </label>
            </div>

            {form.isLegalEntity && (
              <div className="space-y-4 mt-4">
                <div>
                  <h4 className="text-md font-semibold text-dark-charcoal mb-3">
                    {t('branches.viewLaborCard')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-charcoal mb-1">
                        {t('branches.addModalCardNumber')}
                      </label>
                      <input
                        type="text"
                        value={form.laborEstablishmentCardNo}
                        onChange={(e) =>
                          setForm({ ...form, laborEstablishmentCardNo: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-semibold text-dark-charcoal mb-3">
                    {t('branches.viewImmigrationCard')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-charcoal mb-1">
                        {t('branches.addModalCardNumber')}
                      </label>
                      <input
                        type="text"
                        value={form.immigrationCardNo}
                        onChange={(e) =>
                          setForm({ ...form, immigrationCardNo: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-charcoal mb-1">
                        {t('branches.addModalIssueDate')}
                      </label>
                      <DatePicker value={form.immigrationCardIssueDate} onChange={(v) => setForm({ ...form, immigrationCardIssueDate: v })} placeholder={t('branches.leaseModalChooseDate')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-charcoal mb-1">
                        {t('branches.addModalExpiryDate')}
                      </label>
                      <DatePicker value={form.immigrationCardExpiryDate} onChange={(v) => setForm({ ...form, immigrationCardExpiryDate: v })} placeholder={t('branches.leaseModalChooseDate')} />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
          )}

          {/* Section 5: Dynamic Custom Sections */}
          {!isOfficeOrWeb && showLicensesTab && branchPerm.licenses.custom && (
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary-gold/20">
              <h3 className="text-lg font-bold text-primary-gold">{t('branches.addModalCustomSections')}</h3>
              <button
                type="button"
                onClick={addCustomSection}
                className="flex items-center gap-2 px-4 py-2 bg-primary-gold text-white rounded-lg hover:bg-accent-sand transition-colors text-sm"
              >
                <Plus size={18} /> {t('branches.addModalAddSection')}
              </button>
            </div>

            {customSections.length === 0 ? (
              <p className="text-secondary-gray text-sm">{t('branches.addModalNoSectionsHint')}</p>
            ) : (
              <div className="space-y-6">
                {customSections.map((section) => (
                  <div
                    key={section.id}
                    className="bg-white p-4 rounded-lg border border-secondary-gray"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="text"
                        placeholder={t('branches.addModalSectionTitlePlaceholder')}
                        value={section.title}
                        onChange={(e) => updateCustomSection(section.id, 'title', e.target.value)}
                        className="flex-1 px-3 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white mr-2 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomSection(section.id)}
                        className="p-2 text-alert-red hover:bg-alert-red/10 rounded-lg"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {section.rows.map((row) => (
                        <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            placeholder={t('branches.addModalRowKeyPlaceholder')}
                            value={row.key}
                            onChange={(e) => updateCustomRow(section.id, row.id, 'key', e.target.value)}
                            className="col-span-3 px-3 py-2 border border-secondary-gray rounded-lg text-sm"
                          />
                          {row.isDate ? (
                            <DatePicker
                              value={row.value || ''}
                              onChange={(v) => updateCustomRow(section.id, row.id, 'value', v)}
                              placeholder={t('branches.addModalRowValue')}
                              className="col-span-4"
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder={t('branches.addModalRowValue')}
                              value={row.value}
                              onChange={(e) => updateCustomRow(section.id, row.id, 'value', e.target.value)}
                              className="col-span-4 px-3 py-2 border border-secondary-gray rounded-lg text-sm"
                            />
                          )}
                          <label className="col-span-2 flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row.isDate}
                              onChange={(e) => updateCustomRow(section.id, row.id, 'isDate', e.target.checked)}
                              className="w-4 h-4 text-primary-gold rounded"
                            />
                            <span className="text-xs text-dark-charcoal/70">{t('branches.addModalDateLabel')}</span>
                          </label>
                          {row.isDate && (
                            <label className="col-span-2 flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={row.enableAlert ?? false}
                                onChange={(e) => updateCustomRow(section.id, row.id, 'enableAlert', e.target.checked)}
                                className="w-4 h-4 text-primary-gold rounded"
                              />
                              <span className="text-xs text-dark-charcoal/70">{t('branches.addModalAlertLabel')}</span>
                            </label>
                          )}
                          {row.isDate && row.enableAlert && (
                            <div className="col-span-4 flex items-center gap-2">
                              <span className="text-xs text-dark-charcoal/70 shrink-0">{t('branches.addModalAlertBefore')}</span>
                              <input
                                type="number"
                                min="1"
                                value={row.daysBeforeExpiry ?? 30}
                                onChange={(e) => updateCustomRow(section.id, row.id, 'daysBeforeExpiry', parseInt(e.target.value) || 30)}
                                placeholder={t('branches.addModalDays')}
                                className="w-20 px-2 py-1 border border-secondary-gray rounded text-sm"
                              />
                              <span className="text-xs text-dark-charcoal/70">{t('branches.addModalDaysBeforeDate')}</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeCustomRow(section.id, row.id)}
                            className="col-span-1 p-1 text-alert-red hover:bg-alert-red/10 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => addCustomRow(section.id)}
                        className="flex items-center gap-1 text-sm text-primary-gold hover:underline"
                      >
                        <Plus size={14} /> {t('branches.addModalAddRow')}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await window.electronAPI?.fileSelectDocument?.();
                          if (res?.success && res?.filePath) setDocModal({ sectionKey: section.id, sectionLabel: section.title || t('branches.customSection'), sourcePath: res.filePath, customName: '' });
                          else if (!res?.canceled) toast.error(res?.error || t('branches.addModalErrorConnection'));
                        }}
                        className="flex items-center gap-1 text-sm text-primary-gold hover:underline"
                      >
                        <Upload size={14} /> {t('branches.addModalAddDocs')}
                      </button>
                    </div>
                    {pendingDocs.map((d, i) => d.sectionKey === section.id ? (
                      <span key={i} className="inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded mr-2">
                        <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                        <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                      </span>
                    ) : null)}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Document upload modal */}
          {docModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setDocModal(null)}>
              <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h4 className="font-bold text-dark-charcoal mb-2">{t('branches.addModalAddDocTitle')}</h4>
                <p className="text-sm text-dark-charcoal/70 mb-2">{t('branches.addModalDocSectionLabel')} {docModal.sectionLabel}</p>
                <input
                  type="text"
                  placeholder={t('branches.addModalDocNamePlaceholder')}
                  value={docModal.customName}
                  onChange={(e) => setDocModal((m) => m ? { ...m, customName: e.target.value } : null)}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg mb-4"
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setDocModal(null)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('common.cancel')}</button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingDocs((p) => [...p, { ...docModal }]);
                      setDocModal(null);
                      toast.success(t('branches.addModalDocUploadPending'));
                    }}
                    className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand"
                  >
                    {t('branches.addModalAddToList')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          {error && (
            <div className="p-4 mb-2 bg-alert-red/10 border border-alert-red text-alert-red rounded-lg">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-4 border-t border-secondary-gray">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-gold text-white py-3 px-6 rounded-lg hover:bg-accent-sand disabled:opacity-50 font-medium transition-colors"
            >
              {loading ? t('branches.addModalSaving') : isEdit ? t('common.save') : t('branches.addModalSubmitAdd')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-secondary-gray rounded-lg hover:bg-secondary-gray/20 font-medium transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
