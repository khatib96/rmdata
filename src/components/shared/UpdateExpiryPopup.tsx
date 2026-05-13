import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Paperclip } from 'lucide-react';
import { DatePicker } from './DatePicker';
import { useAuthStore } from '../../store/authStore';
import { logActivity } from '../../utils/activityLog';

export interface UpdateExpiryConfig {
  /** الجدول: branch_licenses | branch_leases | lease_installments | employees | branch_establishments | branch_custom_fields */
  table: string;
  /** عمود التاريخ: expiryDate | dueDate | passportExpiryDate | contractExpiryDate | ... */
  column: string;
  /** معرف السجل */
  recordId: number;
  /** عمود WHERE (افتراضي: id). استخدم branchId لـ branch_establishments */
  whereColumn?: string;
}

export interface DocumentLinkConfig {
  /** نوع الكيان: branch | employee | entity */
  entityType: string;
  /** معرف الكيان */
  entityId: number;
  /** قسم المستند: expiry_passport | expiry_contract | ... */
  section: string;
}

export interface ActivityLogParams {
  module: string;
  action: string;
  entityType: string;
  entityId?: number;
  details: string;
}

interface UpdateExpiryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  config: UpdateExpiryConfig;
  documentConfig?: DocumentLinkConfig;
  currentExpiry?: string;
  title: string;
  /** عند التوفير يتم تسجيل النشاط في activity_logs */
  activityLogParams?: ActivityLogParams;
}

export default function UpdateExpiryPopup({
  isOpen,
  onClose,
  onSaved,
  config,
  documentConfig,
  currentExpiry,
  title,
  activityLogParams,
}: UpdateExpiryPopupProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [newExpiry, setNewExpiry] = useState(currentExpiry || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [docPath, setDocPath] = useState<string | null>(null);
  const [docCustomName, setDocCustomName] = useState('');

  const handleSelectDocument = async () => {
    const res = await window.electronAPI?.fileSelectDocument?.();
    if (res?.success && res?.filePath) {
      setDocPath(res.filePath);
      if (!docCustomName.trim()) {
        const parts = res.filePath.replace(/\\/g, '/').split('/');
        setDocCustomName(parts[parts.length - 1] || '');
      }
    }
  };

  const handleSave = async () => {
    if (!newExpiry.trim()) {
      setError(t('common.enterNewExpiry'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (!window.electronAPI?.dbQuery) {
        setError(t('common.connectionUnavailable'));
        setLoading(false);
        return;
      }

      const whereCol = config.whereColumn || 'id';
      const result = await window.electronAPI.dbQuery(
        `UPDATE ${config.table} SET ${config.column} = ? WHERE ${whereCol} = ?`,
        [newExpiry, config.recordId]
      );

      if (!result?.success) {
        setError(result?.error || t('common.updateFailed'));
        setLoading(false);
        return;
      }

      // حفظ المستند إن وُجد
      if (documentConfig && docPath && window.electronAPI?.documentSave) {
        const parts = docPath.replace(/\\/g, '/').split('/');
        const base = parts[parts.length - 1] || 'file';
        const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
        const name = docCustomName.trim()
          ? docCustomName.trim().replace(/[/\\:*?"<>|]/g, '_') + (ext || '')
          : base;
        const entityFolder = documentConfig.entityType === 'branch' ? 'Branches' : documentConfig.entityType === 'employee' ? 'Employees' : documentConfig.entityType === 'employer' ? 'Employers' : documentConfig.entityType === 'vehicle' ? 'Vehicles' : documentConfig.entityType;
        const relativePath = `${entityFolder}/${documentConfig.entityId}/${documentConfig.section}/${name}`;
        await window.electronAPI.documentSave({
          sourceFilePath: docPath,
          relativePath,
          customName: docCustomName.trim() || base,
          entityType: documentConfig.entityType,
          entityId: documentConfig.entityId,
          section: documentConfig.section,
        });
      }

      if (activityLogParams) {
        await logActivity({
          ...activityLogParams,
          details: activityLogParams.details.replace('{newDate}', newExpiry),
          performedByUserId: user?.id,
          performedByUsername: user?.username ?? user?.fullName ?? undefined,
        });
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(t('common.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewExpiry(currentExpiry || '');
    setDocPath(null);
    setDocCustomName('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-secondary-gray">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary-gold flex items-center gap-2">
            <Calendar size={20} /> {title}
          </h3>
          <button onClick={handleClose} className="text-dark-charcoal hover:text-primary-gold">
            <X size={22} />
          </button>
        </div>
        <p className="text-sm text-dark-charcoal/70 mb-3">
          {currentExpiry ? `${t('common.currentExpiry')}: ${currentExpiry}` : t('common.noDateCurrently')}
        </p>
        <label className="block text-sm font-medium text-dark-charcoal mb-1">التاريخ الجديد</label>
        <DatePicker value={newExpiry} onChange={setNewExpiry} placeholder="اختر التاريخ" />

        {documentConfig && (
          <div className="mt-4 pt-4 border-t border-secondary-gray/50">
            <label className="block text-sm font-medium text-dark-charcoal mb-2 flex items-center gap-1">
              <Paperclip size={16} /> {t('common.attachDocumentOptional')}
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectDocument}
                  className="px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm"
                >
                  {t('common.chooseFile')}
                </button>
                {docPath && (
                  <span className="text-sm text-dark-charcoal/70 truncate flex-1 py-2" title={docPath}>
                    {docPath.replace(/^.*[/\\]/, '')}
                  </span>
                )}
              </div>
              {docPath && (
                <div>
                  <label className="block text-xs text-dark-charcoal/60 mb-1">{t('common.documentLabel')}</label>
                  <input
                    type="text"
                    value={docCustomName}
                    onChange={(e) => setDocCustomName(e.target.value)}
                    placeholder={t('common.customDocumentName')}
                    className="w-full px-3 py-2 rounded-lg border border-secondary-gray text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        <div className="flex gap-3 mt-6 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-secondary-gray text-dark-charcoal hover:bg-secondary-gray/20"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand disabled:opacity-60"
          >
            {loading ? t('common.saving') : t('common.update')}
          </button>
        </div>
      </div>
    </div>
  );
}
