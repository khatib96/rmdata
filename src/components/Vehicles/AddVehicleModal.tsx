import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, Plus, Trash2, FileText } from 'lucide-react';
import { DatePicker } from '../shared/DatePicker';
import toast from 'react-hot-toast';
import { generateNextCode } from '../../utils/entityCode';
import {
  VEHICLE_TYPES,
  OWNERSHIP_TYPES,
  INSURANCE_TYPES,
  VEHICLE_BRAND_KEYS,
  AR_BRAND_TO_KEY,
} from '../../constants/vehicles';
import { UAE_EMIRATES } from '../../constants/uae';
import { logActivity } from '../../utils/activityLog';
import { buildChangeSummary } from '../../utils/buildChangeSummary';
import { useAuthStore } from '../../store/authStore';
import { DocumentNameModal } from '../shared/DocumentNameModal';
import type { CustomRow, CustomSection } from './addVehicleModal/addVehicleModalTypes';
import { validateInsert } from '../../utils/validateInsert';

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** عند التعديل: تحميل بيانات المركبة ونفس شكل النافذة مع الحفظ كـ UPDATE */
  editVehicleId?: number | null;
}

interface BranchOption {
  id: number;
  name: string;
  emirate: string;
  tradeName: string | null;
}

const INITIAL = {
  plateNumber: '',
  plateCode: '',
  vehicleName: '',
  brand: '',
  model: '',
  year: '',
  vehicleType: 'sedan',
  ownershipType: 'personal',
  branchId: '',
  ownerName: '',
  issuePlace: '',
  trafficNo: '',
  licenseRegDate: '',
  licenseExpiryDate: '',
  insuranceCompany: '',
  insuranceExpiryDate: '',
  insuranceType: 'third_party',
  insurancePolicyNo: '',
};

function getEmirateLabel(value: string): string {
  const found = UAE_EMIRATES.find((e) => e.value === value);
  return found?.label ?? value;
}

function mapVehicleDocumentSection(sectionKey: string): 'license' | 'insurance' | 'permits' | 'other' {
  const key = (sectionKey || '').trim().toLowerCase();
  if (!key || key === 'general' || key === 'other') return 'other';
  if (['license', 'mulkiya', 'ownership'].includes(key)) return 'license';
  if (key.startsWith('insurance')) return 'insurance';
  if (key === 'permits' || key === 'permit') return 'permits';
  return 'permits';
}

export default function AddVehicleModal({ isOpen, onClose, onSuccess, editVehicleId }: AddVehicleModalProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState(INITIAL);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [pendingDocs, setPendingDocs] = useState<{ sectionKey: string; sectionLabel: string; sourcePath: string; customName: string }[]>([]);
  const [docModal, setDocModal] = useState<{ sectionKey: string; sectionLabel: string; sourcePath: string; customName: string } | null>(null);
  const [generalDocModal, setGeneralDocModal] = useState<{ sourcePath: string; customName: string; section: 'license' | 'insurance' | 'permits' | 'other' } | null>(null);
  const oldFormRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!isOpen || !api?.dbQuery) return;
    (async () => {
      const res = await api.dbQuery(
        `SELECT b.id, b.name, b.emirate, (SELECT tradeName FROM branch_licenses WHERE branchId = b.id LIMIT 1) as tradeName
         FROM branches b
         WHERE (b.status IS NULL OR b.status != 'archived')
         ORDER BY b.name`
      );
      const rows = (res?.data ?? []) as { id: number; name: string; emirate: string; tradeName: string | null }[];
      setBranches(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          emirate: r.emirate || '',
          tradeName: r.tradeName || null,
        }))
      );
    })();
  }, [isOpen]);

  const isEdit = !!editVehicleId;

  useEffect(() => {
    if (!isOpen) return;
    if (!editVehicleId) {
      setForm(INITIAL);
      setPhotoPath(null);
      setImagePreview(null);
      setError('');
      setCustomSections([]);
      setPendingDocs([]);
      setDocModal(null);
      setGeneralDocModal(null);
      return;
    }
    (async () => {
      if (!window.electronAPI?.dbQuery) return;
      const [vRes, cfRes] = await Promise.all([
        window.electronAPI.dbQuery('SELECT * FROM vehicles WHERE id = ?', [editVehicleId]),
        window.electronAPI.dbQuery('SELECT * FROM vehicle_custom_fields WHERE vehicleId = ?', [editVehicleId]),
      ]);
      const v = vRes?.data?.[0] as Record<string, unknown> | undefined;
      if (!v) return;
      const loadedForm = {
        plateNumber: String(v.plateNumber ?? ''),
        plateCode: String(v.plateCode ?? ''),
        vehicleName: String(v.vehicleName ?? ''),
        brand: (AR_BRAND_TO_KEY[String(v.brand ?? '')] ?? (VEHICLE_BRAND_KEYS.includes(String(v.brand) as any) ? String(v.brand) : '')),
        model: String(v.model ?? ''),
        year: v.year != null ? String(v.year) : '',
        vehicleType: String(v.vehicleType ?? 'sedan'),
        ownershipType: String(v.ownershipType ?? 'personal'),
        branchId: v.branchId != null ? String(v.branchId) : '',
        ownerName: String(v.ownerName ?? ''),
        issuePlace: String(v.issuePlace ?? ''),
        trafficNo: String(v.trafficNo ?? ''),
        licenseRegDate: v.licenseRegDate ? String(v.licenseRegDate).slice(0, 10) : '',
        licenseExpiryDate: v.licenseExpiryDate ? String(v.licenseExpiryDate).slice(0, 10) : '',
        insuranceCompany: String(v.insuranceCompany ?? ''),
        insuranceExpiryDate: v.insuranceExpiryDate ? String(v.insuranceExpiryDate).slice(0, 10) : '',
        insuranceType: String(v.insuranceType ?? 'third_party'),
        insurancePolicyNo: String(v.insurancePolicyNo ?? ''),
      };
      setForm(loadedForm);
      oldFormRef.current = { ...loadedForm, photoPath: v.photoPath || null };
      setPhotoPath((v.photoPath as string) || null);
      if (v.photoPath && window.electronAPI?.fileGetImageUrl) {
        const img = await window.electronAPI.fileGetImageUrl(v.photoPath as string);
        setImagePreview(img?.success && img?.url ? img.url : null);
      } else setImagePreview(null);
      const cfList = (cfRes?.data ?? []) as { id: number; title: string; content?: string; enableAlert?: number; alertDate?: string; daysBeforeExpiry?: number }[];
      const sections: CustomSection[] = cfList.map((f) => {
        let rows: CustomRow[] = [];
        try {
          if (f.content) {
            const parsed = JSON.parse(f.content) as { rows?: { key: string; value: string; isDate?: boolean; enableAlert?: boolean; alertDate?: string; daysBeforeExpiry?: number }[] };
            rows = (parsed?.rows ?? []).map((r, j) => ({
              id: `r${f.id}-${j}`,
              key: r.key ?? '',
              value: r.value ?? '',
              isDate: !!r.isDate,
              enableAlert: r.enableAlert,
              alertDate: r.alertDate,
              daysBeforeExpiry: r.daysBeforeExpiry ?? 30,
            }));
          }
        } catch {}
        if (rows.length === 0) rows = [{ id: `r${f.id}-0`, key: '', value: '', isDate: false }];
        return { id: String(f.id), title: f.title || '', rows };
      });
      setCustomSections(sections.length ? sections : []);
      setPendingDocs([]);
      setDocModal(null);
      setGeneralDocModal(null);
      setError('');
    })();
  }, [isOpen, editVehicleId]);

  const addCustomSection = () => {
    setCustomSections((s) => [
      ...s,
      { id: Date.now().toString(), title: '', rows: [{ id: 'r1', key: '', value: '', isDate: false }] },
    ]);
  };
  const removeCustomSection = (id: string) => {
    setCustomSections((s) => s.filter((x) => x.id !== id));
  };
  const updateCustomSection = (id: string, field: 'title', value: string) => {
    setCustomSections((s) => s.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  };
  const addCustomRow = (sectionId: string) => {
    setCustomSections((s) =>
      s.map((x) =>
        x.id === sectionId ? { ...x, rows: [...x.rows, { id: `r${Date.now()}`, key: '', value: '', isDate: false }] } : x
      )
    );
  };
  const removeCustomRow = (sectionId: string, rowId: string) => {
    setCustomSections((s) =>
      s.map((x) => (x.id === sectionId ? { ...x, rows: x.rows.filter((r) => r.id !== rowId) } : x))
    );
  };
  const updateCustomRow = (sectionId: string, rowId: string, field: keyof CustomRow, value: unknown) => {
    setCustomSections((s) =>
      s.map((x) => {
        if (x.id !== sectionId) return x;
        if (field === 'enableAlert' && value === true) {
          return {
            ...x,
            rows: x.rows.map((r) =>
              r.id === rowId ? { ...r, enableAlert: true, alertDate: (r.value || r.alertDate || '') as string } : { ...r, enableAlert: false }
            ),
          };
        }
        return {
          ...x,
          rows: x.rows.map((r) => {
            if (r.id !== rowId) return r;
            const updated = { ...r, [field]: value };
            if (field === 'value' && r.enableAlert && r.isDate) updated.alertDate = value as string;
            return updated;
          }),
        };
      })
    );
  };

  const isCompany = form.ownershipType === 'company';

  const onBranchChange = (branchId: string) => {
    setForm((f) => ({ ...f, branchId }));
    if (!branchId) {
      setForm((f) => ({ ...f, ownerName: '', issuePlace: '' }));
      return;
    }
    const bid = parseInt(branchId, 10);
    const branch = branches.find((b) => b.id === bid);
    if (branch) {
      setForm((f) => ({
        ...f,
        ownerName: branch.tradeName?.trim() || branch.name,
        issuePlace: getEmirateLabel(branch.emirate),
      }));
    }
  };

  const handleImageSelect = async () => {
    if (!window.electronAPI?.fileSelectImage) return;
    const r = await window.electronAPI.fileSelectImage();
    if (r?.canceled || !r?.success || !r?.base64Data || !r?.filename) return;
    const save = await window.electronAPI.fileSaveImage?.(r.base64Data, r.filename);
    if (save?.success && save?.relativePath) {
      setPhotoPath(save.relativePath);
      setImagePreview(r.base64Data.startsWith('data:') ? r.base64Data : `data:image/jpeg;base64,${r.base64Data}`);
    } else {
      toast.error(save?.error || t('vehicles.addModal.imageSaveFailed'));
    }
  };

  const queueVehicleDocument = async (section: 'license' | 'insurance', sectionLabel: string) => {
    const res = await window.electronAPI?.fileSelectDocument?.();
    if (res?.success && res?.filePath) {
      setDocModal({ sectionKey: section, sectionLabel, sourcePath: res.filePath, customName: '' });
      return;
    }
    if (!res?.canceled) toast.error(res?.error || 'فشل اختيار الملف');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const plate = form.plateNumber?.trim();
    if (!plate) {
      setError(t('vehicles.addModal.plateRequiredError'));
      return;
    }
    if (!window.electronAPI?.dbQuery) {
      setError(t('vehicles.addModal.dbUnavailable'));
      return;
    }
    setLoading(true);
    try {
      if (isEdit && editVehicleId) {
        const dup = await window.electronAPI.dbQuery('SELECT id FROM vehicles WHERE plateNumber = ? AND id != ?', [plate, editVehicleId]);
        if (dup?.data?.length) {
          setError(t('vehicles.addModal.plateDuplicateError'));
          setLoading(false);
          return;
        }
        const yearVal = form.year ? parseInt(form.year, 10) : null;
        const branchIdVal = form.branchId ? parseInt(form.branchId, 10) : null;
        const up = await window.electronAPI.dbQuery(
        `UPDATE vehicles SET
          photoPath=?, plateNumber=?, plateCode=?, vehicleName=?, brand=?, model=?, year=?, vehicleType=?, ownershipType=?,
          ownerName=?, issuePlace=?, trafficNo=?,
          licenseRegDate=?, licenseExpiryDate=?, insuranceCompany=?, insuranceExpiryDate=?,
          insuranceType=?, insurancePolicyNo=?, branchId=?
          WHERE id=?`,
        [
            photoPath || null,
            plate,
            form.plateCode?.trim() || null,
            form.vehicleName?.trim() || null,
            form.brand || null,
            form.model || null,
            yearVal,
            form.vehicleType || null,
            form.ownershipType || null,
            form.ownerName || null,
            form.issuePlace || null,
            form.trafficNo || null,
            form.licenseRegDate || null,
            form.licenseExpiryDate || null,
            form.insuranceCompany || null,
            form.insuranceExpiryDate || null,
            form.insuranceType || null,
            form.insurancePolicyNo || null,
            branchIdVal,
            editVehicleId,
          ]
        );
        if (!up?.success) {
          setError(up?.error || t('vehicles.addModal.updateFailed'));
          setLoading(false);
          return;
        }
        await window.electronAPI.dbQuery('DELETE FROM vehicle_custom_fields WHERE vehicleId = ?', [editVehicleId]);
        for (const section of customSections) {
          const content = JSON.stringify({ rows: section.rows });
          const alertRows = section.rows.filter((r) => r.enableAlert && r.isDate && r.value);
          const firstAlertRow = alertRows.length > 0 ? alertRows.reduce((a, b) => (new Date(b.value) > new Date(a.value) ? b : a)) : undefined;
          const alertDate = firstAlertRow ? (firstAlertRow.value || firstAlertRow.alertDate || null) : null;
          await window.electronAPI.dbQuery(
            'INSERT INTO vehicle_custom_fields (vehicleId, title, content, enableAlert, alertDate, daysBeforeExpiry) VALUES (?,?,?,?,?,?)',
            [editVehicleId, section.title || t('vehicles.addModal.customSection'), content, firstAlertRow?.enableAlert ? 1 : 0, alertDate, firstAlertRow?.daysBeforeExpiry ?? null]
          );
        }
        for (const doc of pendingDocs) {
          if (!window.electronAPI?.documentSave) continue;
          const parts = doc.sourcePath.replace(/\\/g, '/').split('/');
          const base = parts[parts.length - 1] || 'file';
          const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
          const name = (doc.customName?.trim()) ? doc.customName.trim().replace(/[/\\:*?"<>|]/g, '_') + ext : base;
          const sectionKey = mapVehicleDocumentSection(doc.sectionKey);
          const relativePath = `Vehicles/${editVehicleId}/${sectionKey}/${name}`;
          const docRes = await window.electronAPI.documentSave({
            sourceFilePath: doc.sourcePath,
            relativePath,
            customName: doc.customName || base,
            entityType: 'vehicle',
            entityId: editVehicleId,
            section: sectionKey,
          });
          if (!docRes?.success) toast.error(docRes?.error || t('vehicles.addModal.saveFailed'));
        }
        const VEHICLE_TRACKED = ['plateNumber', 'plateCode', 'vehicleName', 'brand', 'model', 'year', 'vehicleType', 'ownershipType', 'branchId', 'ownerName', 'issuePlace', 'trafficNo', 'licenseRegDate', 'licenseExpiryDate', 'insuranceCompany', 'insuranceExpiryDate', 'insuranceType', 'insurancePolicyNo', 'photoPath'];
        const logDetails = oldFormRef.current
          ? buildChangeSummary(oldFormRef.current, { ...form, photoPath: photoPath || null }, 'vehicle', form.plateNumber, VEHICLE_TRACKED)
          : `edited::vehicle::${form.plateNumber}`;
        await logActivity({
          module: 'vehicle',
          action: 'edit',
          entityType: 'vehicle',
          entityId: editVehicleId,
          details: logDetails,
          performedByUserId: user?.id,
          performedByUsername: user?.fullName || user?.username,
          performedByUserCode: user?.username,
        });
        toast.success(t('vehicles.addModal.vehicleUpdated'));
        onSuccess();
        onClose();
        return;
      }

      const dup = await window.electronAPI.dbQuery('SELECT id FROM vehicles WHERE plateNumber = ?', [plate]);
      if (dup?.data?.length) {
        setError(t('vehicles.addModal.plateExistsError'));
        setLoading(false);
        return;
      }
      const code = await generateNextCode('RMV', 'vehicles', (sql, params) =>
        window.electronAPI!.dbQuery!(sql, params)
      );
      const yearVal = form.year ? parseInt(form.year, 10) : null;
      const branchIdVal = form.branchId ? parseInt(form.branchId, 10) : null;
      const insertColumns = [
        'code',
        'photoPath',
        'plateNumber',
        'plateCode',
        'vehicleName',
        'brand',
        'model',
        'year',
        'vehicleType',
        'ownershipType',
        'ownerName',
        'issuePlace',
        'trafficNo',
        'licenseRegDate',
        'licenseExpiryDate',
        'insuranceCompany',
        'insuranceExpiryDate',
        'insuranceType',
        'insurancePolicyNo',
        'branchId',
      ];
      const insertValues = [
        code,
        photoPath || null,
        plate,
        form.plateCode?.trim() || null,
        form.vehicleName?.trim() || null,
        form.brand || null,
        form.model || null,
        yearVal,
        form.vehicleType || null,
        form.ownershipType || null,
        form.ownerName || null,
        form.issuePlace || null,
        form.trafficNo || null,
        form.licenseRegDate || null,
        form.licenseExpiryDate || null,
        form.insuranceCompany || null,
        form.insuranceExpiryDate || null,
        form.insuranceType || null,
        form.insurancePolicyNo || null,
        branchIdVal,
      ];
      validateInsert(insertColumns, insertValues);
      const ins = await window.electronAPI.dbQuery(
        `INSERT INTO vehicles (
          code, photoPath, plateNumber, plateCode, vehicleName, brand, model, year, vehicleType, ownershipType,
          ownerName, issuePlace, trafficNo,
          licenseRegDate, licenseExpiryDate, insuranceCompany, insuranceExpiryDate,
          insuranceType, insurancePolicyNo, branchId, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        insertValues
      );
      if (!ins?.success) {
        setError(ins?.error || t('vehicles.addModal.addFailed'));
        return;
      }
      let vehicleId = ins.lastInsertId ?? 0;
      if (!vehicleId) {
        const chk = await window.electronAPI.dbQuery('SELECT id FROM vehicles WHERE plateNumber = ? ORDER BY id DESC LIMIT 1', [plate]);
        vehicleId = chk?.data?.[0]?.id;
      }
      if (!vehicleId) {
        setError(t('vehicles.addModal.getIdFailed'));
        setLoading(false);
        return;
      }

      for (const section of customSections) {
        const content = JSON.stringify({ rows: section.rows });
        const alertRows = section.rows.filter((r) => r.enableAlert && r.isDate && r.value);
        const firstAlertRow = alertRows.length > 0 ? alertRows.reduce((a, b) => (new Date(b.value) > new Date(a.value) ? b : a)) : undefined;
        const alertDate = firstAlertRow ? (firstAlertRow.value || firstAlertRow.alertDate || null) : null;
        await window.electronAPI.dbQuery(
          'INSERT INTO vehicle_custom_fields (vehicleId, title, content, enableAlert, alertDate, daysBeforeExpiry) VALUES (?,?,?,?,?,?)',
          [vehicleId, section.title || t('vehicles.addModal.customSection'), content, firstAlertRow?.enableAlert ? 1 : 0, alertDate, firstAlertRow?.daysBeforeExpiry ?? null]
        );
      }
      for (const doc of pendingDocs) {
        if (!window.electronAPI?.documentSave) continue;
        const parts = doc.sourcePath.replace(/\\/g, '/').split('/');
        const base = parts[parts.length - 1] || 'file';
        const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
        const name = (doc.customName?.trim()) ? doc.customName.trim().replace(/[/\\:*?"<>|]/g, '_') + ext : base;
        const sectionKey = mapVehicleDocumentSection(doc.sectionKey);
        const relativePath = `Vehicles/${vehicleId}/${sectionKey}/${name}`;
        const docRes = await window.electronAPI.documentSave({
          sourceFilePath: doc.sourcePath,
          relativePath,
          customName: doc.customName || base,
          entityType: 'vehicle',
          entityId: vehicleId,
          section: sectionKey,
        });
        if (!docRes?.success) toast.error(docRes?.error || t('vehicles.addModal.saveFailed'));
      }
      await logActivity({
        module: 'vehicle',
        action: 'create',
        entityType: 'vehicle',
        entityId: vehicleId,
        details: `created::vehicle::${form.plateNumber}`,
        performedByUserId: user?.id,
        performedByUsername: user?.fullName || user?.username,
        performedByUserCode: user?.username,
      });
      toast.success(t('vehicles.addModal.vehicleAdded'));
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('vehicles.addModal.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-primary-gold text-white p-6 flex items-center justify-between z-10 shrink-0">
          <h2 className="text-2xl font-bold">{isEdit ? t('vehicles.addModal.titleEdit') : t('vehicles.addModal.titleAdd')}</h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-2">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 bg-alert-red/10 border border-alert-red text-alert-red rounded-lg">{error}</div>
          )}

          {/* أساسي */}
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <h3 className="text-lg font-bold text-primary-gold mb-4 pb-2 border-b border-primary-gold/20">
              {t('vehicles.addModal.basicInfo')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.plateRequired')}</label>
                  <input
                    type="text"
                    required
                    value={form.plateNumber}
                    onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                    placeholder={t('vehicles.addModal.platePlaceholder')}
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.plateCode')}</label>
                  <input
                    type="text"
                    value={form.plateCode}
                    onChange={(e) => setForm({ ...form, plateCode: e.target.value })}
                    className="w-full px-2 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                    placeholder="أ"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.vehicleName')}</label>
                <input
                  type="text"
                  value={form.vehicleName}
                  onChange={(e) => setForm({ ...form, vehicleName: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                  placeholder={t('vehicles.addModal.vehicleNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.brand')}</label>
                <select
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                >
                  <option value="">{t('vehicles.addModal.chooseOption')}</option>
                  {VEHICLE_BRAND_KEYS.map((key) => (
                    <option key={key} value={key}>{t(`vehicles.brands.${key}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.model')}</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.year')}</label>
                <input
                  type="number"
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.vehicleType')}</label>
                <select
                  value={form.vehicleType}
                  onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                >
                  {VEHICLE_TYPES.map((vt) => (
                    <option key={vt.value} value={vt.value}>{t(`vehicles.types.${vt.value}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.vehiclePhoto')}</label>
                <div className="flex items-center gap-2">
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => { setImagePreview(null); setPhotoPath(null); }}
                        className="absolute -top-1 -right-1 bg-alert-red text-white rounded-full p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleImageSelect}
                      className="px-3 py-2 border-2 border-dashed border-secondary-gray rounded-lg hover:border-primary-gold text-sm"
                    >
                      <Upload size={18} className="inline ml-1" /> {t('vehicles.addModal.uploadPhoto')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ملكية */}
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <h3 className="text-lg font-bold text-primary-gold mb-4 pb-2 border-b border-primary-gold/20">
              {t('vehicles.addModal.ownershipTitle')}
            </h3>
            <div className="mb-3">
              <button
                type="button"
                onClick={() => void queueVehicleDocument('license', 'الملكية')}
                className="flex items-center gap-1 text-sm text-primary-gold hover:underline"
              >
                <Upload size={14} /> إرفاق مستند الملكية
              </button>
              {pendingDocs.map((d, globalIdx) => d.sectionKey === 'license' ? (
                <span key={globalIdx} className="inline-flex items-center gap-1 mt-2 ml-2 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                  <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                  <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== globalIdx))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                </span>
              ) : null)}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.ownershipType')}</label>
                <select
                  value={form.ownershipType}
                  onChange={(e) => {
                    const v = e.target.value as 'company' | 'personal';
                    setForm({ ...form, ownershipType: v, branchId: v === 'personal' ? '' : form.branchId });
                    if (v === 'personal') setForm((f) => ({ ...f, ownerName: '', issuePlace: '' }));
                  }}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                >
                  {OWNERSHIP_TYPES.map((ot) => (
                    <option key={ot.value} value={ot.value}>{t(`vehicles.ownership.${ot.value}`)}</option>
                  ))}
                </select>
              </div>
              {isCompany && (
                <div>
                  <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.branchOwner')}</label>
                  <select
                    value={form.branchId}
                    onChange={(e) => onBranchChange(e.target.value)}
                    className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                  >
                    <option value="">{t('vehicles.addModal.chooseBranch')}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {isCompany ? t('vehicles.addModal.ownerAuto') : t('vehicles.addModal.ownerManual')}
                </label>
                <input
                  type="text"
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  readOnly={isCompany}
                  className={`w-full px-4 py-2 border border-secondary-gray rounded-lg bg-white ${isCompany ? 'bg-secondary-gray/20' : ''}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">
                  {isCompany ? t('vehicles.addModal.issuePlaceAuto') : t('vehicles.addModal.issuePlaceManual')}
                </label>
                {isCompany ? (
                  <input
                    type="text"
                    readOnly
                    value={form.issuePlace}
                    className="w-full px-4 py-2 border border-secondary-gray rounded-lg bg-secondary-gray/20"
                  />
                ) : (
                  <input
                    type="text"
                    value={form.issuePlace}
                    onChange={(e) => setForm({ ...form, issuePlace: e.target.value })}
                    className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                    placeholder={t('vehicles.addModal.issuePlacePlaceholder')}
                  />
                )}
              </div>
            </div>
          </div>

          {/* رخصة ومرور */}
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <h3 className="text-lg font-bold text-primary-gold mb-4 pb-2 border-b border-primary-gold/20">
              {t('vehicles.addModal.licenseTitle')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.trafficNo')}</label>
                <input
                  type="text"
                  value={form.trafficNo}
                  onChange={(e) => setForm({ ...form, trafficNo: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.licenseRegDate')}</label>
                <DatePicker
                  value={form.licenseRegDate}
                  onChange={(v) => setForm({ ...form, licenseRegDate: v })}
                  placeholder={t('vehicles.addModal.chooseDate')}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.licenseExpiryDate')}</label>
                <DatePicker
                  value={form.licenseExpiryDate}
                  onChange={(v) => setForm({ ...form, licenseExpiryDate: v })}
                  placeholder={t('vehicles.addModal.chooseDate')}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* التأمين */}
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <h3 className="text-lg font-bold text-primary-gold mb-4 pb-2 border-b border-primary-gold/20">
              {t('vehicles.addModal.insuranceTitle')}
            </h3>
            <div className="mb-3">
              <button
                type="button"
                onClick={() => void queueVehicleDocument('insurance', 'التأمين')}
                className="flex items-center gap-1 text-sm text-primary-gold hover:underline"
              >
                <Upload size={14} /> إرفاق مستند التأمين
              </button>
              {pendingDocs.map((d, globalIdx) => d.sectionKey === 'insurance' ? (
                <span key={globalIdx} className="inline-flex items-center gap-1 mt-2 ml-2 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                  <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                  <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== globalIdx))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                </span>
              ) : null)}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.insuranceCompany')}</label>
                <input
                  type="text"
                  value={form.insuranceCompany}
                  onChange={(e) => setForm({ ...form, insuranceCompany: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.insuranceType')}</label>
                <select
                  value={form.insuranceType}
                  onChange={(e) => setForm({ ...form, insuranceType: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                >
                  {INSURANCE_TYPES.map((it) => (
                    <option key={it.value} value={it.value}>{t(`vehicles.insuranceTypes.${it.value}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.policyNo')}</label>
                <input
                  type="text"
                  value={form.insurancePolicyNo}
                  onChange={(e) => setForm({ ...form, insurancePolicyNo: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.addModal.insuranceExpiryDate')}</label>
                <DatePicker
                  value={form.insuranceExpiryDate}
                  onChange={(v) => setForm({ ...form, insuranceExpiryDate: v })}
                  placeholder={t('vehicles.addModal.chooseDate')}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* تراخيص وتصاريح إضافية */}
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary-gold/20">
              <h3 className="text-lg font-bold text-primary-gold">{t('vehicles.addModal.permitsTitle')}</h3>
              <button
                type="button"
                onClick={addCustomSection}
                className="flex items-center gap-2 px-4 py-2 bg-primary-gold text-white rounded-lg hover:bg-primary-gold/90 text-sm"
              >
                <Plus size={18} /> {t('vehicles.addModal.addSection')}
              </button>
            </div>
            {customSections.length === 0 ? (
              <p className="text-secondary-gray text-sm">{t('vehicles.addModal.noSections')}</p>
            ) : (
              <div className="space-y-6">
                {customSections.map((section) => (
                  <div key={section.id} className="bg-white p-4 rounded-lg border border-secondary-gray">
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="text"
                        placeholder={t('vehicles.addModal.sectionPlaceholder')}
                        value={section.title}
                        onChange={(e) => updateCustomSection(section.id, 'title', e.target.value)}
                        className="flex-1 px-3 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white ml-2 font-medium"
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
                            placeholder={t('vehicles.addModal.keyPlaceholder')}
                            value={row.key}
                            onChange={(e) => updateCustomRow(section.id, row.id, 'key', e.target.value)}
                            className="col-span-3 px-3 py-2 border border-secondary-gray rounded-lg text-sm"
                          />
                          {row.isDate ? (
                            <DatePicker value={row.value || ''} onChange={(v) => updateCustomRow(section.id, row.id, 'value', v)} placeholder={t('vehicles.addModal.valuePlaceholder')} className="col-span-4" />
                          ) : (
                            <input type="text" placeholder={t('vehicles.addModal.valuePlaceholder')} value={row.value} onChange={(e) => updateCustomRow(section.id, row.id, 'value', e.target.value)} className="col-span-4 px-3 py-2 border border-secondary-gray rounded-lg text-sm" />
                          )}
                          <label className="col-span-2 flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={row.isDate} onChange={(e) => updateCustomRow(section.id, row.id, 'isDate', e.target.checked)} className="w-4 h-4 text-primary-gold rounded" />
                            <span className="text-xs text-dark-charcoal/70">{t('vehicles.addModal.isDate')}</span>
                          </label>
                          {row.isDate && (
                            <label className="col-span-2 flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={row.enableAlert ?? false} onChange={(e) => updateCustomRow(section.id, row.id, 'enableAlert', e.target.checked)} className="w-4 h-4 text-primary-gold rounded" />
                              <span className="text-xs text-dark-charcoal/70">{t('vehicles.addModal.alert')}</span>
                            </label>
                          )}
                          {row.isDate && row.enableAlert && (
                            <div className="col-span-4 flex items-center gap-2">
                              <span className="text-xs text-dark-charcoal/70 shrink-0">{t('vehicles.addModal.alertBefore')}</span>
                              <input type="number" min={1} value={row.daysBeforeExpiry ?? 30} onChange={(e) => updateCustomRow(section.id, row.id, 'daysBeforeExpiry', parseInt(e.target.value, 10) || 30)} className="w-20 px-2 py-1 border border-secondary-gray rounded text-sm" />
                              <span className="text-xs text-dark-charcoal/70">{t('vehicles.addModal.daysFromDate')}</span>
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
                        <Plus size={14} /> {t('vehicles.addModal.addRow')}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await window.electronAPI?.fileSelectDocument?.();
                          if (res?.success && res?.filePath) setDocModal({ sectionKey: section.id, sectionLabel: section.title || t('vehicles.addModal.customSection'), sourcePath: res.filePath, customName: '' });
                          else if (!res?.canceled) toast.error(res?.error || 'فشل اختيار الملف');
                        }}
                        className="flex items-center gap-1 text-sm text-primary-gold hover:underline"
                      >
                        <Upload size={14} /> {t('vehicles.addModal.addDocuments')}
                      </button>
                    </div>
                    {pendingDocs.map((d, globalIdx) => d.sectionKey === section.id ? (
                      <span key={globalIdx} className="inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded ml-2">
                        <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                        <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== globalIdx))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                      </span>
                    ) : null)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* إضافة مستند مع تسميته */}
          <div className="bg-light-background rounded-lg p-6 border border-secondary-gray">
            <h3 className="text-lg font-bold text-primary-gold mb-2 pb-2 border-b border-primary-gold/20">{t('vehicles.addModal.addDocuments')}</h3>
            <p className="text-sm text-dark-charcoal/70 mb-2">{t('vehicles.addModal.addDocHint')}</p>
            <button
              type="button"
              onClick={async () => {
                const res = await window.electronAPI?.fileSelectDocument?.();
                if (res?.success && res?.filePath) setGeneralDocModal({ sourcePath: res.filePath, customName: '', section: 'other' });
                else if (!res?.canceled) toast.error(res?.error || 'فشل اختيار الملف');
              }}
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-primary-gold/50 text-primary-gold rounded-lg hover:bg-primary-gold/10 text-sm"
            >
              <Upload size={18} /> {t('vehicles.addModal.addDocWithName')}
            </button>
            {pendingDocs.map((d, globalIdx) => ['general', 'permits', 'other'].includes(d.sectionKey) ? (
              <span key={globalIdx} className="inline-flex items-center gap-1 mt-2 mr-2 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== globalIdx))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
              </span>
            ) : null)}
          </div>

          <DocumentNameModal
            open={!!docModal}
            title={t('vehicles.addModal.addDocTitle')}
            subtitle={docModal ? `${t('vehicles.addModal.docSection')}: ${docModal.sectionLabel}` : undefined}
            value={docModal?.customName ?? ''}
            onChange={(v) => setDocModal((m) => (m ? { ...m, customName: v } : null))}
            placeholder={t('vehicles.addModal.docNameOptional')}
            cancelLabel={t('vehicles.cancel')}
            confirmLabel={t('vehicles.addModal.addToList')}
            onCancel={() => setDocModal(null)}
            onConfirm={() => {
              if (!docModal) return;
              setPendingDocs((p) => [...p, { ...docModal }]);
              setDocModal(null);
              toast.success(t('vehicles.addModal.docWillUpload'));
            }}
          />

          <DocumentNameModal
            open={!!generalDocModal}
            title={t('vehicles.addModal.addDocTitle')}
            value={generalDocModal?.customName ?? ''}
            onChange={(v) => setGeneralDocModal((m) => (m ? { ...m, customName: v } : null))}
            placeholder={t('vehicles.addModal.docNameOptional')}
            cancelLabel={t('vehicles.cancel')}
            confirmLabel={t('vehicles.addModal.addToList')}
            onCancel={() => setGeneralDocModal(null)}
            onConfirm={() => {
              if (!generalDocModal) return;
              setPendingDocs((p) => [
                ...p,
                {
                  sectionKey: generalDocModal.section,
                  sectionLabel:
                    generalDocModal.section === 'license'
                      ? 'الملكية'
                      : generalDocModal.section === 'insurance'
                        ? 'التأمين'
                        : generalDocModal.section === 'permits'
                          ? 'الموافقات الإضافية'
                          : t('vehicles.addModal.documentsLabel'),
                  sourcePath: generalDocModal.sourcePath,
                  customName: generalDocModal.customName,
                },
              ]);
              setGeneralDocModal(null);
              toast.success(t('vehicles.addModal.docWillUpload'));
            }}
          />
          {generalDocModal && (
            <div className="mt-2">
              <label className="block text-xs text-dark-charcoal/70 mb-1">{t('vehicles.addModal.docSection')}</label>
              <select
                value={generalDocModal.section}
                onChange={(e) => setGeneralDocModal((m) => (m ? { ...m, section: e.target.value as 'license' | 'insurance' | 'permits' | 'other' } : null))}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg bg-white text-sm"
              >
                <option value="license">الملكية</option>
                <option value="insurance">التأمين</option>
                <option value="permits">الموافقات الإضافية</option>
                <option value="other">أخرى</option>
              </select>
            </div>
          )}

            <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-6 py-2 border border-secondary-gray rounded-lg text-dark-charcoal hover:bg-secondary-gray/20">{t('vehicles.cancel')}</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-primary-gold text-white rounded-lg hover:bg-primary-gold/90 disabled:opacity-50">
              {loading ? t('vehicles.addModal.saving') : isEdit ? t('vehicles.addModal.saveEdits') : t('vehicles.addModal.saveVehicle')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
