import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, PhoneCall, Building2, User, Upload, FileText } from 'lucide-react';
import { generateNextCode } from '../../utils/entityCode';
import { logActivity } from '../../utils/activityLog';
import { buildChangeSummary } from '../../utils/buildChangeSummary';
import { useAuthStore } from '../../store/authStore';

interface AddPhoneModalProps {
  onClose: () => void;
  onSuccess: () => void;
  editPhoneId?: number | null;
  branches: { id: number; name: string }[];
  employees: { id: number; name: string }[];
  employers: { id: number; name: string }[];
  housings: { id: number; name: string }[];
  legalEntities: { id: number; name: string }[];
}

/** قيمة التعيين لأفراد: "" | "e:employeeId" | "o:employerId" */
function getIndividualValue(employeeId: string, employerId: string): string {
  if (employeeId) return `e:${employeeId}`;
  if (employerId) return `o:${employerId}`;
  return '';
}

export default function AddPhoneModal({ onClose, onSuccess, editPhoneId, branches, employees, employers, housings, legalEntities }: AddPhoneModalProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [pendingDocs, setPendingDocs] = useState<{ sourcePath: string; customName: string; sectionKey: string }[]>([]);
  const [docModal, setDocModal] = useState<{ sourcePath: string; customName: string; sectionKey: string } | null>(null);
  const [formData, setFormData] = useState({
    phoneNumber: '',
    provider: 'etisalat',
    category: 'postpaid',
    numberType: 'mobile',
    billAmount: '',
    legalEntityId: '',
    registeredName: '',
    assignedBranchId: '',
    assignedEmployeeId: '',
    assignedEmployerId: '',
    assignedHousingId: '',
    note: ''
  });
  const oldFormRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (editPhoneId && window.electronAPI?.dbQuery) {
      setLoading(true);
      window.electronAPI.dbQuery('SELECT * FROM phones WHERE id = ?', [editPhoneId])
        .then((res: any) => {
          if (res?.success && res.data?.[0]) {
            const p = res.data[0];
            const formDataObj = {
              phoneNumber: p.phoneNumber || '',
              provider: p.provider || 'etisalat',
              category: p.category || 'postpaid',
              numberType: p.numberType || 'mobile',
              billAmount: p.billAmount ? String(p.billAmount) : '',
              legalEntityId: p.legalEntityId ? String(p.legalEntityId) : '',
              registeredName: p.registeredName || '',
              assignedBranchId: p.assignedBranchId ? String(p.assignedBranchId) : '',
              assignedEmployeeId: p.assignedEmployeeId ? String(p.assignedEmployeeId) : '',
              assignedEmployerId: p.assignedEmployerId ? String(p.assignedEmployerId) : '',
              assignedHousingId: p.assignedHousingId ? String(p.assignedHousingId) : '',
              note: p.note || ''
            };
            setFormData(formDataObj);
            oldFormRef.current = { ...formDataObj };
          }
        })
        .finally(() => setLoading(false));
    }
  }, [editPhoneId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phoneNumber) {
      alert(t('phones.addModal.enterPhone'));
      return;
    }

    if (!window.electronAPI?.dbQuery) {
      alert(t('phones.addModal.dbUnavailable'));
      setLoading(false);
      return;
    }

    try {
      let phoneId = editPhoneId;
      let isSuccess = false;

      if (editPhoneId) {
        setLoading(true);
        const result = await window.electronAPI.dbQuery(
          `UPDATE phones SET
            phoneNumber=?, provider=?, category=?, numberType=?,   
            billAmount=?, legalEntityId=?, registeredName=?, 
            assignedBranchId=?, assignedEmployeeId=?, assignedEmployerId=?, assignedHousingId=?, note=?
           WHERE id=?`,
          [
            formData.phoneNumber,
            formData.provider,
            formData.category,
            formData.numberType,
            formData.category === 'postpaid' && formData.billAmount ? parseFloat(formData.billAmount) : null,
            formData.category === 'postpaid' && formData.legalEntityId ? parseInt(formData.legalEntityId) : null,
            formData.category === 'prepaid' ? formData.registeredName : null,
            formData.assignedBranchId || null,
            formData.assignedEmployeeId || null,
            formData.assignedEmployerId || null,
            formData.assignedHousingId || null,
            formData.note || null,
            editPhoneId
          ]
        );
        isSuccess = !!result?.success;
      } else {
        setLoading(true);
        const code = await generateNextCode(
          'RMP',
          'phones',
          (sql: string, params?: unknown[]) => window.electronAPI!.dbQuery!(sql, params) as Promise<{ success?: boolean; data?: { code?: string }[] }>
        );

        const result = await window.electronAPI.dbQuery(
          `INSERT INTO phones (
            code, phoneNumber, provider, category, numberType,   
            billAmount, legalEntityId, registeredName, 
            assignedBranchId, assignedEmployeeId, assignedEmployerId, assignedHousingId, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            code,
            formData.phoneNumber,
            formData.provider,
            formData.category,
            formData.numberType,
            formData.category === 'postpaid' && formData.billAmount ? parseFloat(formData.billAmount) : null,
            formData.category === 'postpaid' && formData.legalEntityId ? parseInt(formData.legalEntityId) : null,
            formData.category === 'prepaid' ? formData.registeredName : null,
            formData.assignedBranchId || null,
            formData.assignedEmployeeId || null,
            formData.assignedEmployerId || null,
            formData.assignedHousingId || null,
            formData.note || null
          ]
        );
        isSuccess = !!result?.success;
        if (isSuccess && (result as any)?.lastInsertId) {
          phoneId = (result as any).lastInsertId;
        } else if (isSuccess) {
           const checkRes = await window.electronAPI.dbQuery('SELECT id FROM phones WHERE phoneNumber = ? ORDER BY id DESC LIMIT 1', [formData.phoneNumber]);
           phoneId = (checkRes?.data?.[0] as any)?.id;
        }
      }

      if (isSuccess) {
        // تحديث هاتف العمل للموظف إذا كان فارغاً (أول رقم يضاف هو الأساسي)
        if (formData.assignedEmployeeId && !editPhoneId) {
          try {
            const empRes = await window.electronAPI.dbQuery(
              'SELECT phone FROM employees WHERE id = ?',
              [formData.assignedEmployeeId]
            );
            const emp = empRes?.data?.[0] as { phone?: string } | undefined;
            if (emp && (!emp.phone || emp.phone.trim() === '')) {
              await window.electronAPI.dbQuery(
                'UPDATE employees SET phone = ? WHERE id = ?',
                [formData.phoneNumber, formData.assignedEmployeeId]
              );
            }
          } catch (err) {
            console.error('Error auto-updating employee phone:', err);
          }
        }
        // نفس الطريقة لصاحب العمل: تحديث phone في employers إذا كان فارغاً
        if (formData.assignedEmployerId && !editPhoneId) {
          try {
            const empRes = await window.electronAPI.dbQuery(
              'SELECT phone FROM employers WHERE id = ?',
              [formData.assignedEmployerId]
            );
            const emp = empRes?.data?.[0] as { phone?: string } | undefined;
            if (emp && (!emp.phone || emp.phone.trim() === '')) {
              await window.electronAPI.dbQuery(
                'UPDATE employers SET phone = ? WHERE id = ?',
                [formData.phoneNumber, formData.assignedEmployerId]
              );
            }
          } catch (err) {
            console.error('Error auto-updating employer phone:', err);
          }
        }

        // Save Documents
        if (phoneId && pendingDocs.length > 0 && window.electronAPI) {
          for (const doc of pendingDocs) {
            const parts = doc.sourcePath.replace(/\\/g, '/').split('/');
            const base = parts[parts.length - 1] || 'file';
            const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
            const name = (doc.customName && doc.customName.trim())
              ? doc.customName.trim().replace(/[/\\:*?"<>|]/g, '_') + ext
              : base;
            
            const relativePath = `Phones/${phoneId}/${doc.sectionKey}/${name}`;
            const api = window.electronAPI as any;
            await api.documentSave({
              sourceFilePath: doc.sourcePath,
              relativePath,
              customName: doc.customName || base,
              entityType: 'phone',
              entityId: phoneId,
              section: doc.sectionKey,
            });
          }
        }

        const PHONE_TRACKED = ['phoneNumber', 'provider', 'category', 'numberType', 'billAmount', 'legalEntityId', 'registeredName', 'assignedBranchId', 'assignedEmployeeId', 'assignedEmployerId', 'assignedHousingId', 'note'];
        let logDetails: string;
        if (editPhoneId && oldFormRef.current) {
          logDetails = buildChangeSummary(oldFormRef.current, { ...formData }, 'phone', formData.phoneNumber, PHONE_TRACKED);
        } else {
          logDetails = `${editPhoneId ? 'edited' : 'created'}::phone::${formData.phoneNumber}`;
        }
        await logActivity({
          module: 'phone',
          action: editPhoneId ? 'edit' : 'create',
          entityType: 'phone',
          entityId: phoneId ?? editPhoneId ?? undefined,
          details: logDetails,
          performedByUserId: user?.id,
          performedByUsername: user?.fullName || user?.username,
          performedByUserCode: user?.username,
        });
        onSuccess();
        onClose();
      } else {
        throw new Error(t('phones.addModal.saveFailed'));
      }
    } catch (error) {
      console.error('Error adding phone:', error);
      alert(t('phones.addModal.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-secondary-gray/30 flex justify-between items-center bg-light-background">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-gold/10 flex items-center justify-center">
              <PhoneCall className="text-primary-gold" size={24} />
            </div>
            <h2 className="text-xl font-bold text-dark-charcoal">{editPhoneId ? t('phones.addModal.titleEdit') : t('phones.addModal.titleAdd')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary-gray/20 rounded-full transition-colors"
          >
            <X size={20} className="text-dark-charcoal" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-charcoal mb-2">
                {t('phones.addModal.phoneRequired')}
              </label>
              <input
                type="text"
                required
                placeholder={t('phones.addModal.phonePlaceholder')}
                className="w-full border border-secondary-gray rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold transition-colors text-left"
                dir="ltr"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-2">{t('phones.addModal.provider')}</label>
              <select
                className="w-full border border-secondary-gray rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              >
                <option value="etisalat">{t('phones.providerEtisalat')} (Etisalat)</option>
                <option value="du">{t('phones.providerDu')} (Du)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-2">{t('phones.addModal.numberType')}</label>
              <select
                 className="w-full border border-secondary-gray rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold"
                 value={formData.numberType}
                 onChange={(e) => setFormData({ ...formData, numberType: e.target.value })}
              >
                 <option value="mobile">{t('phones.addModal.mobile')}</option>
                 <option value="landline">{t('phones.addModal.landline')}</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark-charcoal mb-2">{t('phones.addModal.category')}</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 bg-white hover:bg-light-background transition-colors">
                  <input
                    type="radio"
                    name="category"
                    value="postpaid"
                    checked={formData.category === 'postpaid'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="text-primary-gold focus:ring-primary-gold"
                  />
                  <span className="font-medium">{t('phones.addModal.postpaid')}</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 bg-white hover:bg-light-background transition-colors">
                  <input
                    type="radio"
                    name="category"
                    value="prepaid"
                    checked={formData.category === 'prepaid'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="text-primary-gold focus:ring-primary-gold"
                  />
                  <span className="font-medium">{t('phones.addModal.prepaid')}</span>
                </label>
              </div>
            </div>

            {/* الحقول المتغيرة بناءً على فئة الدفع */}
            {formData.category === 'postpaid' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-dark-charcoal mb-2">
                    {t('phones.addModal.registeredAsPostpaid')}
                  </label>
                  <select
                    className="w-full border border-secondary-gray rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold"
                    value={formData.legalEntityId}
                    onChange={(e) => setFormData({ ...formData, legalEntityId: e.target.value })}
                  >
                    <option value="">{t('phones.addModal.optional')}</option>
                    {legalEntities.map(entity => (
                      <option key={entity.id} value={entity.id}>{entity.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-charcoal mb-2">
                    {t('phones.addModal.expectedBill')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-secondary-gray rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold"
                    value={formData.billAmount}
                    onChange={(e) => setFormData({ ...formData, billAmount: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-charcoal mb-2">
                  {t('phones.addModal.registeredNameLabel')}
                </label>
                <input
                  type="text"
                  placeholder={t('phones.addModal.registeredNamePlaceholder')}
                  className="w-full border border-secondary-gray rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold"
                  value={formData.registeredName}
                  onChange={(e) => setFormData({ ...formData, registeredName: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="h-px bg-gradient-to-l from-transparent via-primary-gold/50 to-transparent my-6" />

          {/* التعيين (Assignment) */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-dark-charcoal flex items-center gap-2">
              {t('phones.addModal.assignmentTitle')}
              <span className="text-xs font-normal text-secondary-gray">{t('phones.addModal.assignmentOptional')}</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-secondary-gray rounded-lg p-4 bg-light-background/50 relative">
                <div className="flex items-center gap-2 mb-3 text-primary-gold font-medium">
                  <User size={18} /> {t('phones.addModal.individuals')}
                </div>
                <select
                  className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-sm bg-white"
                  value={getIndividualValue(formData.assignedEmployeeId, formData.assignedEmployerId)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setFormData({ ...formData, assignedEmployeeId: '', assignedEmployerId: '', assignedBranchId: '', assignedHousingId: '' });
                      return;
                    }
                    if (v.startsWith('e:')) {
                      setFormData({ ...formData, assignedEmployeeId: v.slice(2), assignedEmployerId: '', assignedBranchId: '', assignedHousingId: '' });
                    } else {
                      setFormData({ ...formData, assignedEmployerId: v.slice(2), assignedEmployeeId: '', assignedBranchId: '', assignedHousingId: '' });
                    }
                  }}
                >
                  <option value="">{t('phones.addModal.cancelOption')}</option>
                  <optgroup label={t('phones.addModal.employeesGroup')}>
                    {employees.map((emp) => (
                      <option key={`e-${emp.id}`} value={`e:${emp.id}`}>{emp.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label={t('phones.addModal.employersGroup')}>
                    {employers.map((emp) => (
                      <option key={`o-${emp.id}`} value={`o:${emp.id}`}>{emp.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="border border-secondary-gray rounded-lg p-4 bg-light-background/50 relative">
                 <div className="flex items-center gap-2 mb-3 text-primary-gold font-medium">
                  <Building2 size={18} /> {t('phones.addModal.branchOrFacility')}
                 </div>
                 <select
                  className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-sm bg-white"
                  value={formData.assignedBranchId}
                  onChange={(e) => setFormData({ ...formData, assignedBranchId: e.target.value, assignedEmployeeId: '', assignedEmployerId: '', assignedHousingId: '' })}
                 >
                   <option value="">{t('phones.addModal.cancelOption')}</option>
                   {branches.map(b => (
                     <option key={b.id} value={b.id}>{b.name}</option>
                   ))}
                 </select>
              </div>

              <div className="border border-secondary-gray rounded-lg p-4 bg-light-background/50 relative">
                 <div className="flex items-center gap-2 mb-3 text-primary-gold font-medium">
                  <Building2 size={18} /> {t('phones.addModal.labourHousing')}
                 </div>
                 <select
                  className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-sm bg-white"
                  value={formData.assignedHousingId}
                  onChange={(e) => setFormData({ ...formData, assignedHousingId: e.target.value, assignedEmployeeId: '', assignedEmployerId: '', assignedBranchId: '' })}
                 >
                   <option value="">{t('phones.addModal.cancelOption')}</option>
                   {housings.map(h => (
                     <option key={h.id} value={h.id}>{h.name}</option>
                   ))}
                 </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-charcoal mb-2">{t('phones.addModal.additionalNotes')}</label>
            <textarea
              rows={3}
              placeholder={t('phones.addModal.notesPlaceholder')}
              className="w-full border border-secondary-gray rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-gold focus:border-primary-gold resize-none"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />
          </div>

          <div className="h-px bg-gradient-to-l from-transparent via-primary-gold/50 to-transparent my-6" />

          <div>
            <h3 className="text-lg font-bold text-dark-charcoal flex items-center gap-2 mb-4">
              {t('phones.addModal.lineDocuments')}
              <span className="text-xs font-normal text-secondary-gray">{t('phones.addModal.lineDocumentsHint')}</span>
            </h3>
            <button
              type="button"
              onClick={async () => {
                const api = window.electronAPI as any;
                const res = await api?.fileSelectDocument?.();
                if (res?.success && res?.filePath) {
                  setDocModal({ sectionKey: 'phone_documents', sourcePath: res.filePath, customName: '' });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm transition-colors"
            >
              <Upload size={16} /> {t('phones.addModal.addDocument')}
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              {pendingDocs.map((d, i) => (
                <div key={i} className="flex items-center gap-2 bg-secondary-gray/30 px-3 py-1.5 rounded-lg text-sm text-dark-charcoal">
                  <FileText size={14} className="text-primary-gold" />
                  <span dir="ltr">{d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}</span>
                  <button type="button" onClick={() => setPendingDocs(p => p.filter((_, j) => j !== i))} className="text-alert-red hover:bg-alert-red/10 rounded p-1">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Document modal */}
        {docModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setDocModal(null)}>
            <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h4 className="font-bold text-dark-charcoal mb-2">{t('phones.addModal.addDocTitle')}</h4>
              <p className="text-sm text-dark-charcoal/70 mb-4 truncate" dir="ltr">{docModal.sourcePath.replace(/^.*[/\\]/, '')}</p>
              <input
                type="text"
                placeholder={t('phones.addModal.docLabelOptional')}
                value={docModal.customName}
                onChange={(e) => setDocModal(m => m ? { ...m, customName: e.target.value } : null)}
                className="w-full px-4 py-2 border border-secondary-gray rounded-lg mb-4 text-right"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setDocModal(null)} className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20 font-medium">{t('phones.addModal.cancel')}</button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingDocs(p => [...p, { ...docModal }]);
                    setDocModal(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium"
                >
                  {t('phones.addModal.addDocButton')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 border-t border-secondary-gray/30 bg-light-background flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-lg font-medium text-dark-charcoal bg-white border border-secondary-gray hover:bg-secondary-gray/10 transition-colors"
          >
            {t('phones.addModal.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white bg-primary-gold hover:bg-accent-sand transition-colors disabled:opacity-50"
          >
            <Save size={20} />
            {loading ? t('phones.addModal.saving') : editPhoneId ? t('phones.addModal.saveEdit') : t('phones.addModal.savePhone')}
          </button>
        </div>
      </div>
    </div>
  );
}
