import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Paperclip, Plus } from 'lucide-react';
import { DatePicker } from '../shared/DatePicker';
import { useAuthStore } from '../../store/authStore';
import { logActivity } from '../../utils/activityLog';
import { usePermissions } from '../../hooks/usePermissions';
import { canBranchFieldInTab } from '../../services/branchPermissions';

interface InstallmentRow {
  id: number;
  seq: number;
  amount: number;
  dueDate?: string;
  note?: string;
}

interface UpdateLeaseExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  leaseId: number;
  branchId: number;
  branchName: string;
  currentExpiry: string;
  installments: InstallmentRow[];
}

type PaymentType = 'single' | 'multiple';

type LocalInstallment = { id: string; amount: string; dueDate: string; note: string };

export default function UpdateLeaseExpiryModal({
  isOpen,
  onClose,
  onSaved,
  leaseId,
  branchId,
  branchName: _branchName,
  currentExpiry,
  installments: initialInstallments,
}: UpdateLeaseExpiryModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { permissions, granularFieldBypass } = usePermissions();
  const canSchedule = useMemo(
    () =>
      granularFieldBypass ||
      canBranchFieldInTab(permissions, 'licenses', 'field.leasePaymentSchedule.view'),
    [granularFieldBypass, permissions]
  );
  const canInstAmt = useMemo(
    () =>
      granularFieldBypass ||
      canBranchFieldInTab(permissions, 'licenses', 'field.leaseInstallmentAmounts.view'),
    [granularFieldBypass, permissions]
  );
  /** بدون جدول دفعات ولا مبالغ لكن توجد دفعات في DB — نحدّث التاريخ فقط ولا نمسح الجدول */
  const preserveInstallmentsOnly = useMemo(
    () =>
      !granularFieldBypass &&
      initialInstallments.length > 0 &&
      !canSchedule &&
      !canInstAmt,
    [granularFieldBypass, initialInstallments.length, canSchedule, canInstAmt]
  );
  const showPaymentSection = !preserveInstallmentsOnly && (canSchedule || canInstAmt);
  const [newExpiry, setNewExpiry] = useState(currentExpiry || '');
  const [paymentType, setPaymentType] = useState<PaymentType>(initialInstallments.length > 0 ? 'multiple' : 'single');
  const [installments, setInstallments] = useState<LocalInstallment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [docPath, setDocPath] = useState<string | null>(null);
  const [docCustomName, setDocCustomName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewExpiry(currentExpiry ? String(currentExpiry).slice(0, 10) : '');
      const hasMulti = initialInstallments.length > 0;
      setPaymentType(hasMulti ? 'multiple' : 'single');
      setInstallments(
        hasMulti
          ? initialInstallments.map((i) => ({
              id: `i${i.id}`,
              amount: String(Number(i.amount)),
              dueDate: i.dueDate ? String(i.dueDate).slice(0, 10) : '',
              note: i.note || '',
            }))
          : []
      );
      setDocPath(null);
      setDocCustomName('');
      setError('');
    }
  }, [isOpen, currentExpiry, initialInstallments]);

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

  const setInstField = (instId: string, field: 'amount' | 'dueDate' | 'note', value: string) => {
    setInstallments((prev) => prev.map((p) => (p.id === instId ? { ...p, [field]: value } : p)));
  };

  const addInstallment = () => {
    setInstallments((prev) => [...prev, { id: `i${Date.now()}`, amount: '', dueDate: '', note: '' }]);
  };

  const removeInstallment = (instId: string) => {
    setInstallments((prev) => prev.filter((p) => p.id !== instId));
  };

  const handleSave = async () => {
    if (!newExpiry.trim()) {
      setError(t('branches.leaseModalErrorExpiry'));
      return;
    }
    if (!preserveInstallmentsOnly && paymentType === 'multiple' && canInstAmt) {
      const validInst = installments.filter((i) => (parseFloat(i.amount) || 0) > 0 && i.dueDate.trim());
      if (validInst.length === 0) {
        setError(t('branches.leaseModalErrorInstallment'));
        return;
      }
    }
    if (!preserveInstallmentsOnly && paymentType === 'multiple' && !canInstAmt && canSchedule) {
      const validInst = installments.filter((i) => i.dueDate.trim());
      if (validInst.length === 0) {
        setError(t('branches.leaseModalErrorInstallment'));
        return;
      }
    }
    setError('');
    setLoading(true);
    try {
      const api = window.electronAPI;
      if (!api?.dbQuery) {
        setError(t('branches.leaseModalErrorConnection'));
        setLoading(false);
        return;
      }

      await api.dbQuery('UPDATE branch_leases SET expiryDate = ? WHERE id = ?', [newExpiry, leaseId]);

      if (preserveInstallmentsOnly) {
        /* لا تغيير على lease_installments */
      } else {
        await api.dbQuery('DELETE FROM lease_installments WHERE leaseId = ?', [leaseId]);
        if (paymentType === 'multiple') {
          const validInst = installments.filter((i) => {
            if (!i.dueDate.trim()) return false;
            if (canInstAmt) return (parseFloat(i.amount) || 0) > 0;
            return true;
          });
          for (let seq = 0; seq < validInst.length; seq++) {
            const inst = validInst[seq];
            await api.dbQuery(
              'INSERT INTO lease_installments (leaseId, seq, amount, dueDate, note) VALUES (?,?,?,?,?)',
              [leaseId, seq, parseFloat(inst.amount) || 0, inst.dueDate, inst.note.trim() || null]
            );
          }
        }
      }

      if (docPath && api.documentSave) {
        const parts = docPath.replace(/\\/g, '/').split('/');
        const base = parts[parts.length - 1] || 'file';
        const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
        const name = docCustomName.trim()
          ? docCustomName.trim().replace(/[/\\:*?"<>|]/g, '_') + (ext || '')
          : base;
        const relPath = `Branches/${branchId}/lease_expiry/${name}`;
        await api.documentSave({
          sourceFilePath: docPath,
          relativePath: relPath,
          customName: docCustomName.trim() || base,
          entityType: 'branch',
          entityId: branchId,
          section: 'lease_expiry',
        });
      }

      const validInst =
        paymentType === 'multiple'
          ? installments.filter((i) => {
              if (!i.dueDate.trim()) return false;
              if (canInstAmt) return (parseFloat(i.amount) || 0) > 0;
              return true;
            })
          : [];
      const instDetail = validInst.length > 0
        ? validInst.map((i, idx) => `الدفعة ${idx + 1}: ${i.dueDate}${i.note ? ` (${i.note})` : ''}`).join('؛ ')
        : '';
      await logActivity({
        module: 'branch',
        action: 'expiry_update',
        entityType: 'branch',
        entityId: branchId,
        details: `leaseExpiryUpdate::${newExpiry}::${instDetail || ''}`,
        performedByUserId: user?.id,
        performedByUsername: user?.username ?? user?.fullName ?? undefined,
      });

      onSaved();
      onClose();
    } catch {
      setError(t('branches.leaseModalErrorSave'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const inputClass = 'w-full px-3 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white text-sm';
  const labelClass = 'block text-sm font-medium text-dark-charcoal mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-4 p-6 border border-secondary-gray">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-lg font-bold text-primary-gold flex items-center gap-2">
            <Calendar size={20} /> {t('branches.leaseModalTitle')}
          </h3>
          <button onClick={handleClose} className="text-dark-charcoal hover:text-primary-gold">
            <X size={22} />
          </button>
        </div>
        <p className="text-sm text-dark-charcoal/70 mb-3">{t('branches.leaseModalCurrentExpiry')} {currentExpiry || '—'}</p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t('branches.leaseModalNewDate')}</label>
            <DatePicker value={newExpiry} onChange={setNewExpiry} placeholder={t('branches.leaseModalChooseDate')} />
          </div>

          {showPaymentSection && (
            <>
              <div>
                <label className={labelClass}>{t('branches.leaseModalPaymentType')}</label>
                <select
                  value={paymentType}
                  onChange={(e) => {
                    const v = e.target.value as PaymentType;
                    setPaymentType(v);
                    if (v === 'multiple' && installments.length === 0) {
                      setInstallments([{ id: `i${Date.now()}`, amount: '', dueDate: '', note: '' }]);
                    } else if (v === 'single') {
                      setInstallments([]);
                    }
                  }}
                  className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white"
                >
                  <option value="single">{t('branches.leaseModalSingle')}</option>
                  <option value="multiple">{t('branches.leaseModalMultiple')}</option>
                </select>
              </div>

              {paymentType === 'multiple' && (canSchedule || canInstAmt) && (
                <div className="border border-secondary-gray rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-primary-gold font-medium">{t('branches.leaseModalInstallmentsTable')}</h4>
                    {canSchedule && (
                      <button
                        type="button"
                        onClick={addInstallment}
                        className="flex items-center gap-1 text-sm text-primary-gold hover:underline"
                      >
                        <Plus size={14} /> {t('branches.leaseModalAddInstallment')}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-dark-charcoal/70 mb-3">{t('branches.leaseModalInstallmentsHint')}</p>
                  <div className="space-y-3">
                    {installments.map((inst, idx) => (
                      <div key={inst.id} className="flex flex-wrap items-center gap-3 p-3 bg-secondary-gray/10 rounded-lg">
                        <span className="text-sm font-medium text-dark-charcoal w-8 shrink-0">#{idx + 1}</span>
                        <div className="min-w-[100px]">
                          <label className="text-xs text-dark-charcoal/60 block mb-1">{t('branches.leaseModalAmount')}</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t('branches.leaseModalAmount')}
                            value={inst.amount}
                            readOnly={!canInstAmt}
                            onChange={(e) => setInstField(inst.id, 'amount', e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className="min-w-[120px]">
                          <label className="text-xs text-dark-charcoal/60 block mb-1">{t('branches.leaseModalDueDate')}</label>
                          <DatePicker
                            value={inst.dueDate}
                            onChange={(v) => setInstField(inst.id, 'dueDate', v)}
                            placeholder={t('branches.leaseModalChooseDate')}
                            disabled={!canSchedule}
                          />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                          <label className="text-xs text-dark-charcoal/60 block mb-1">{t('branches.leaseModalNoteOptional')}</label>
                          <input
                            type="text"
                            value={inst.note}
                            readOnly={!canSchedule}
                            onChange={(e) => setInstField(inst.id, 'note', e.target.value)}
                            placeholder={t('branches.leaseModalNotePlaceholder')}
                            className={inputClass}
                          />
                        </div>
                        {canSchedule && (
                          <button
                            type="button"
                            onClick={() => removeInstallment(inst.id)}
                            className="p-1 text-alert-red hover:bg-alert-red/10 rounded shrink-0"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canInstAmt && installments.length > 0 && (
                    <p className="text-sm text-dark-charcoal/70 mt-2">
                      {t('branches.leaseModalTotal')}{' '}
                      <strong>
                        {installments
                          .reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
                          .toLocaleString('en', { minimumFractionDigits: 0 })}{' '}
                        {t('branches.leaseModalAed')}
                      </strong>
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="pt-4 border-t border-secondary-gray/50">
            <label className={`${labelClass} flex items-center gap-1`}>
              <Paperclip size={16} /> {t('branches.leaseModalAttachDoc')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectDocument}
                className="px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm"
              >
                {t('branches.leaseModalSelectFile')}
              </button>
              {docPath && (
                <span className="text-sm text-dark-charcoal/70 truncate flex-1 py-2" title={docPath}>
                  {docPath.replace(/^.*[/\\]/, '')}
                </span>
              )}
            </div>
            {docPath && (
              <div className="mt-2">
                <label className="block text-xs text-dark-charcoal/60 mb-1">{t('branches.leaseModalDocLabel')}</label>
                <input type="text" value={docCustomName} onChange={(e) => setDocCustomName(e.target.value)} placeholder={t('branches.leaseModalDocLabelPlaceholder')} className={inputClass} />
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
        <div className="flex gap-3 mt-6 justify-end">
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-lg border border-secondary-gray text-dark-charcoal hover:bg-secondary-gray/20">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleSave} disabled={loading} className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand disabled:opacity-60">
            {loading ? t('settings.saving') : t('branches.leaseModalUpdate')}
          </button>
        </div>
      </div>
    </div>
  );
}
