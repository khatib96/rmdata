import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { UAE_EMIRATES } from '../../constants/uae';
import { generateNextCode } from '../../utils/entityCode';
import { FormModal } from '../shared/FormModal';
import { FormSection } from '../shared/FormSection';
import { DatePicker } from '../shared/DatePicker';
import { logActivity } from '../../utils/activityLog';
import { buildChangeSummary } from '../../utils/buildChangeSummary';
import { useAuthStore } from '../../store/authStore';
import { isOptionalEmail, isOptionalPhone } from '../../utils/validation';

interface Branch {
  id: number;
  name: string;
  tradeName?: string;
  emirate?: string;
  branchType?: string;
}

interface AddEmployerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editEmployerId?: number | null;
}

const INITIAL_FORM = {
  fullName: '',
  fullNameEn: '',
  nationality: '',
  phone: '',
  email: '',
  occupation: '',
  notes: '',
  passportNumber: '',
  passportIssueDate: '',
  passportExpiryDate: '',
  passportCountry: '',
  emiratesId: '',
  emiratesIdIssueDate: '',
  emiratesIdExpiryDate: '',
  issueEmirate: '',
};

export default function AddEmployerModal({ isOpen, onClose, onSuccess, editEmployerId }: AddEmployerModalProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateLinkedEntityImagePath = useAuthStore((s) => s.updateLinkedEntityImagePath);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFilename, setImageFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [, setBranches] = useState<Branch[]>([]);
  const [, setLinkedBranches] = useState<{ branchId: number; role: string; ownershipPercent: string }[]>([]);
  const [pendingDocs, setPendingDocs] = useState<{ sectionKey: string; sourcePath: string; customName: string }[]>([]);
  const [docModal, setDocModal] = useState<{ sectionKey: string; sectionLabel: string; sourcePath: string; customName: string } | null>(null);
  const [nationalities, setNationalities] = useState<string[]>([]);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const oldFormRef = useRef<Record<string, unknown> | null>(null);

  const isEdit = !!editEmployerId;
  const STEPS = useMemo(() => [
    { step: 1, label: t('employers.stepBasic') },
    { step: 2, label: t('employers.stepPassport') },
    { step: 3, label: t('employers.stepIdResidency') },
  ], [t]);

  // --- Load branches and nationalities on open ---
  useEffect(() => {
    if (!isOpen || !window.electronAPI?.dbQuery) return;
    (async () => {
      const bRes = await window.electronAPI!.dbQuery!(
        `SELECT b.id, b.name, b.emirate, b.branchType,
         (SELECT tradeName FROM branch_licenses WHERE branchId = b.id LIMIT 1) as tradeName
         FROM branches b WHERE (b.status IS NULL OR b.status != 'archived') ORDER BY b.name`
      );
      setBranches(bRes?.data || []);

      const natRes = await window.electronAPI!.dbQuery!(
        `SELECT DISTINCT nationality FROM employers WHERE nationality IS NOT NULL AND nationality != '' ORDER BY nationality`
      );
      const empNatRes = await window.electronAPI!.dbQuery!(
        `SELECT DISTINCT nationality FROM employees WHERE nationality IS NOT NULL AND nationality != '' ORDER BY nationality`
      );
      const merged = [...new Set([
        ...(natRes?.data || []).map((r: { nationality: string }) => r.nationality),
        ...(empNatRes?.data || []).map((r: { nationality: string }) => r.nationality),
      ])].filter(Boolean).sort();
      setNationalities(merged);
    })();
  }, [isOpen]);

  // --- Load existing employer data in edit mode ---
  useEffect(() => {
    if (!isOpen || !editEmployerId || !window.electronAPI?.dbQuery) return;
    (async () => {
      const res = await window.electronAPI!.dbQuery!('SELECT * FROM employers WHERE id = ?', [editEmployerId]);
      const emp = res?.data?.[0];
      if (emp) {
        const loadedForm = {
          fullName: emp.fullName || '',
          fullNameEn: emp.fullNameEn || '',
          nationality: emp.nationality || '',
          phone: emp.phone || '',
          email: emp.email || '',
          occupation: emp.occupation || '',
          notes: emp.notes || '',
          passportNumber: emp.passportNumber || '',
          passportIssueDate: emp.passportIssueDate ? String(emp.passportIssueDate).slice(0, 10) : '',
          passportExpiryDate: emp.passportExpiry ? String(emp.passportExpiry).slice(0, 10) : '',
          passportCountry: emp.passportCountry || '',
          emiratesId: emp.emiratesId || '',
          emiratesIdIssueDate: emp.emiratesIdIssueDate ? String(emp.emiratesIdIssueDate).slice(0, 10) : '',
          emiratesIdExpiryDate: emp.emiratesIdExpiry ? String(emp.emiratesIdExpiry).slice(0, 10) : '',
          issueEmirate: emp.issueEmirate || '',
        };
        setForm(loadedForm);
        setExistingImagePath(emp.photoPath || null);
        oldFormRef.current = { ...loadedForm, photoPath: emp.photoPath || null };
        if (emp.photoPath && window.electronAPI?.fileGetImageUrl) {
          const imgRes = await window.electronAPI.fileGetImageUrl(emp.photoPath);
          if (imgRes?.success && imgRes.url) setImagePreview(imgRes.url);
        }
        // Load existing branch links
        const linkRes = await window.electronAPI!.dbQuery!(
          'SELECT branchId, role, ownershipPercent FROM branch_employers WHERE employerId = ?', [editEmployerId]
        );
        setLinkedBranches((linkRes?.data || []).map((r: { branchId: number; role: string; ownershipPercent: number }) => ({
          branchId: r.branchId,
          role: r.role || 'owner',
          ownershipPercent: r.ownershipPercent != null ? String(r.ownershipPercent) : '',
        })));
      }
    })();
  }, [isOpen, editEmployerId]);

  const handleImageSelect = async () => {
    if (!window.electronAPI?.fileSelectImage) return;
    const result = await window.electronAPI.fileSelectImage();
    if (result?.success && result.base64Data && result.filename) {
      setImagePreview(result.base64Data);
      setImageFilename(result.filename);
    }
  };

  const handleAddDoc = async (sectionKey: string, sectionLabel: string) => {
    const res = await window.electronAPI?.fileSelectDocument?.();
    if (res?.success && res?.filePath) setDocModal({ sectionKey, sectionLabel, sourcePath: res.filePath, customName: '' });
    else if (!res?.canceled) toast.error(res?.error || t('employers.fileSelectFailed'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length) {
      setStep((s) => Math.min(STEPS.length, s + 1));
      return;
    }
    setError('');
    if (!form.fullName?.trim()) { setError(t('employers.fullNameRequired')); return; }
    if (!isOptionalEmail(form.email)) { setError(t('validation.invalidEmail')); return; }
    if (!isOptionalPhone(form.phone)) { setError(t('validation.invalidPhone')); return; }
    setLoading(true);
    try {
      if (!window.electronAPI?.dbQuery) throw new Error(t('employers.dbUnavailable'));

      let imagePath: string | null = null;
      if (imagePreview && imageFilename && window.electronAPI.fileSaveImage) {
        const ext = imageFilename.split('.').pop() || 'jpg';
        const saveResult = await window.electronAPI.fileSaveImage(imagePreview, `employer_${Date.now()}.${ext}`);
        if (!saveResult?.success) {
          throw new Error(saveResult?.error || t('employers.saveFailed'));
        }
        if (saveResult.relativePath) imagePath = saveResult.relativePath;
        else if (saveResult.fullPath) imagePath = saveResult.fullPath;
      } else if (isEdit && existingImagePath) {
        imagePath = existingImagePath;
      }

      let employerId: number;

      if (isEdit && editEmployerId) {
        const upRes = await window.electronAPI.dbQuery(
          `UPDATE employers SET fullName=?, fullNameEn=?, nationality=?, phone=?, email=?, occupation=?, notes=?,
           passportNumber=?, passportIssueDate=?, passportExpiry=?, passportCountry=?,
           emiratesId=?, emiratesIdIssueDate=?, emiratesIdExpiry=?, issueEmirate=?, photoPath=?
           WHERE id=?`,
          [
            form.fullName, form.fullNameEn || null, form.nationality || null, form.phone || null,
            form.email || null, form.occupation || null, form.notes || null,
            form.passportNumber || null, form.passportIssueDate || null, form.passportExpiryDate || null,
            form.passportCountry || null, form.emiratesId || null, form.emiratesIdIssueDate || null,
            form.emiratesIdExpiryDate || null, form.issueEmirate || null, imagePath,
            editEmployerId,
          ]
        );
        if (!upRes?.success) throw new Error(upRes?.error || t('employers.updateFailed'));
        employerId = editEmployerId;
      } else {
        const empCode = await generateNextCode('RMO', 'employers', (sql, params) =>
          window.electronAPI!.dbQuery!(sql, params)
        );
        const insRes = await window.electronAPI.dbQuery(
          `INSERT INTO employers (code, fullName, fullNameEn, nationality, phone, email, occupation, notes,
           passportNumber, passportIssueDate, passportExpiry, passportCountry,
           emiratesId, emiratesIdIssueDate, emiratesIdExpiry, issueEmirate, photoPath, status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            empCode, form.fullName, form.fullNameEn || null, form.nationality || null,
            form.phone || null, form.email || null, form.occupation || null, form.notes || null,
            form.passportNumber || null, form.passportIssueDate || null, form.passportExpiryDate || null,
            form.passportCountry || null, form.emiratesId || null, form.emiratesIdIssueDate || null,
            form.emiratesIdExpiryDate || null, form.issueEmirate || null, imagePath, 'active',
          ]
        );
        if (!insRes?.success) throw new Error(insRes?.error || t('employers.addFailed'));
        employerId = insRes?.lastInsertId ?? 0;
        if (!employerId) {
          const chk = await window.electronAPI.dbQuery('SELECT id FROM employers WHERE fullName = ? ORDER BY id DESC LIMIT 1', [form.fullName]);
          employerId = chk?.data?.[0]?.id ?? 0;
        }
      }

      // ربط الأفرع يُدار من صفحة الملف الشخصي (زر "ربط بالأفرع") وليس من هذا النموذج

      // Save documents
      if (window.electronAPI?.documentSave && employerId) {
        const basePath = `Employers/${employerId}`;
        const sectionPaths: Record<string, string> = {
          passport: `${basePath}/passport`,
          residency: `${basePath}/residency`,
        };
        for (const doc of pendingDocs) {
          const parts = doc.sourcePath.replace(/\\/g, '/').split('/');
          const base = parts[parts.length - 1] || 'file';
          const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
          const name = (doc.customName && doc.customName.trim())
            ? doc.customName.trim().replace(/[/\\:*?"<>|]/g, '_') + ext
            : base;
          const relPath = `${sectionPaths[doc.sectionKey] || basePath}/${name}`;
          await window.electronAPI.documentSave({
            sourceFilePath: doc.sourcePath, relativePath: relPath,
            customName: doc.customName || base, entityType: 'employer',
            entityId: employerId, section: doc.sectionKey,
          });
        }
      }

      const EMPLOYER_TRACKED = ['fullName', 'fullNameEn', 'nationality', 'phone', 'email', 'occupation', 'notes', 'passportNumber', 'passportIssueDate', 'passportExpiryDate', 'passportCountry', 'emiratesId', 'emiratesIdIssueDate', 'emiratesIdExpiryDate', 'issueEmirate', 'photoPath'];
      let logDetails: string;
      if (isEdit && oldFormRef.current) {
        logDetails = buildChangeSummary(oldFormRef.current, { ...form }, 'employer', form.fullName, EMPLOYER_TRACKED);
      } else {
        logDetails = `${isEdit ? 'edited' : 'created'}::employer::${form.fullName}`;
      }
      await logActivity({
        module: 'employer',
        action: isEdit ? 'edit' : 'create',
        entityType: 'employer',
        entityId: employerId,
        details: logDetails,
        performedByUserId: user?.id,
        performedByUsername: user?.fullName || user?.username,
        performedByUserCode: user?.username,
      });

      // If the logged-in user is linked to this employer, refresh avatar in auth store
      // so sidebar/mobile profile image updates without re-login.
      if (user?.userType === 'linked' && user.linkedEntityType === 'employer' && user.linkedEntityId === employerId) {
        const refreshed = await window.electronAPI?.authRefreshLinkedImage?.(user.id);
        if (refreshed?.success) updateLinkedEntityImagePath(refreshed.linkedEntityImagePath ?? null);
      }

      toast.success(isEdit ? t('employers.savedSuccess') : t('employers.addedSuccess'));
      onSuccess();
      onClose();
      setStep(1);
      setForm(INITIAL_FORM);
      setImagePreview(null);
      setImageFilename(null);
      setPendingDocs([]);
      setLinkedBranches([]);
      setExistingImagePath(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      toast.error(t('employers.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white';
  const labelClass = 'block text-sm font-medium text-dark-charcoal mb-1';

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t('employers.addModalTitleEdit') : t('employers.addModalTitleNew')}
      subtitle={t('employers.addModalSubtitle')}
      steps={STEPS}
      currentStep={step}
      onStepClick={setStep}
    >
      <form onSubmit={handleSubmit} className="p-6">
        {error && <div className="mb-4 p-3 bg-alert-red/10 text-alert-red rounded-lg text-sm">{error}</div>}

        {/* الخطوة 1: البيانات الأساسية */}
        {step === 1 && (
          <FormSection title={t('employers.basicInfo')}>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>{t('employers.photo')}</label>
                <div className="flex items-center gap-4">
                  {imagePreview && <img src={imagePreview} alt="" className="w-20 h-20 object-cover rounded-lg border" />}
                  <button type="button" onClick={handleImageSelect} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10">
                    <Upload size={18} /> {t('employers.choosePhoto')}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>{t('employers.fullNameAr')}</label>
                <input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputClass} required placeholder={t('employers.fullNameArPlaceholder')} />
              </div>
              <div>
                <label className={labelClass}>{t('employers.fullNameEn')}</label>
                <input type="text" value={form.fullNameEn} onChange={(e) => setForm({ ...form, fullNameEn: e.target.value })} className={inputClass} placeholder={t('employers.fullNameEnPlaceholder')} dir="ltr" />
              </div>
              <div>
                <label className={labelClass}>{t('employers.nationality')}</label>
                <input
                  type="text"
                  list="employer-nationalities"
                  value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  placeholder={t('employers.nationalityPlaceholder')}
                  className={inputClass}
                />
                <datalist id="employer-nationalities">
                  {nationalities.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label className={labelClass}>{t('employers.phoneLabel')}</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} dir="ltr" />
              </div>
              <div>
                <label className={labelClass}>{t('employers.emailLabel')}</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} dir="ltr" />
              </div>
              <div>
                <label className={labelClass}>{t('employers.occupationLabel')}</label>
                <input type="text" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} className={inputClass} placeholder={t('employers.occupationPlaceholder')} />
              </div>
              <div>
                <label className={labelClass}>{t('employers.notesLabel')}</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={`${inputClass} resize-none`} />
              </div>
            </div>
          </FormSection>
        )}

        {/* الخطوة 2: الجواز */}
        {step === 2 && (
          <FormSection title={t('employers.passportData')}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>{t('employers.passportNumberLabel')}</label><input type="text" value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} className={inputClass} dir="ltr" /></div>
                <div><label className={labelClass}>{t('employers.passportCountry')}</label><input type="text" value={form.passportCountry} onChange={(e) => setForm({ ...form, passportCountry: e.target.value })} className={inputClass} /></div>
                <div><label className={labelClass}>{t('employers.issueDate')}</label><DatePicker value={form.passportIssueDate} onChange={(v) => setForm({ ...form, passportIssueDate: v })} placeholder={t('employers.chooseDate')} /></div>
                <div><label className={labelClass}>{t('employers.expiryDate')}</label><DatePicker value={form.passportExpiryDate} onChange={(v) => setForm({ ...form, passportExpiryDate: v })} placeholder={t('employers.chooseDate')} /></div>
              </div>
              <div>
                <button type="button" onClick={() => handleAddDoc('passport', t('employers.passport'))} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm">
                  <Upload size={16} /> {t('employers.addPassportImage')}
                </button>
                {pendingDocs.filter(d => d.sectionKey === 'passport').map((d, i) => (
                  <span key={i} className="mr-2 inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                    <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                    <button type="button" onClick={() => setPendingDocs(p => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          </FormSection>
        )}

        {/* الخطوة 3: الهوية والإقامة */}
        {step === 3 && (
          <FormSection title={t('employers.emiratesIdResidencySection')}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClass}>{t('employers.emiratesIdNumber')}</label>
                  <input type="text" value={form.emiratesId} onChange={(e) => setForm({ ...form, emiratesId: e.target.value })} className={inputClass} placeholder={t('employers.emiratesIdPlaceholder')} dir="ltr" />
                </div>
                <div><label className={labelClass}>{t('employers.issueDate')}</label><DatePicker value={form.emiratesIdIssueDate} onChange={(v) => setForm({ ...form, emiratesIdIssueDate: v })} placeholder={t('employers.chooseDate')} /></div>
                <div><label className={labelClass}>{t('employers.expiryDate')}</label><DatePicker value={form.emiratesIdExpiryDate} onChange={(v) => setForm({ ...form, emiratesIdExpiryDate: v })} placeholder={t('employers.chooseDate')} /></div>
                <div className="col-span-2">
                  <label className={labelClass}>{t('employers.issueEmirate')}</label>
                  <select value={form.issueEmirate} onChange={(e) => setForm({ ...form, issueEmirate: e.target.value })} className={inputClass}>
                    <option value="">{t('employers.chooseEmirate')}</option>
                    {UAE_EMIRATES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <button type="button" onClick={() => handleAddDoc('residency', t('employers.emiratesIdResidency'))} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm">
                  <Upload size={16} /> {t('employers.addIdResidencyImage')}
                </button>
                {pendingDocs.filter(d => d.sectionKey === 'residency').map((d, i) => (
                  <span key={i} className="mr-2 inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded">
                    <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
                    <button type="button" onClick={() => setPendingDocs(p => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          </FormSection>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t">
          <button type="button" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="flex items-center gap-2 px-4 py-2 rounded-lg border disabled:opacity-50">
            <ChevronRight size={18} /> {t('employers.previous')}
          </button>
          {step < STEPS.length ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStep((s) => Math.min(STEPS.length, s + 1)); }}
              className="flex items-center gap-2 px-6 py-2 bg-primary-gold text-white rounded-lg"
            >
              {t('employers.next')} <ChevronLeft size={18} />
            </button>
          ) : (
            <button type="submit" disabled={loading} className="px-6 py-2 bg-primary-gold text-white rounded-lg disabled:opacity-50">
              {loading ? t('employers.saving') : isEdit ? t('employers.saveChanges') : t('employers.addEmployerSubmit')}
            </button>
          )}
        </div>
      </form>

      {/* Doc Name Modal */}
      {docModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setDocModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h4 className="font-bold text-dark-charcoal mb-2">{t('employers.addDocTitle')}</h4>
            <p className="text-sm text-dark-charcoal/70 mb-2">{t('employers.sectionLabel')}: {docModal.sectionLabel}</p>
            <input
              type="text"
              placeholder={t('employers.docNamePlaceholder')}
              value={docModal.customName}
              onChange={(e) => setDocModal(m => m ? { ...m, customName: e.target.value } : null)}
              className="w-full px-4 py-2 border border-secondary-gray rounded-lg mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDocModal(null)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">{t('employers.cancel')}</button>
              <button
                type="button"
                onClick={() => {
                  setPendingDocs(p => [...p, { sectionKey: docModal.sectionKey, sourcePath: docModal.sourcePath, customName: docModal.customName }]);
                  setDocModal(null);
                  toast.success(t('employers.docUploadOnSave'));
                }}
                className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand"
              >
                {t('employers.addToList')}
              </button>
            </div>
          </div>
        </div>
      )}
    </FormModal>
  );
}
