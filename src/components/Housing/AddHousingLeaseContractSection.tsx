import { Plus, Upload, X, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { DatePicker } from '../shared/DatePicker';

export type LeasePaymentType = 'single' | 'multiple';

/** Subset of housing form used by the lease/contract section */
export interface HousingFormLeaseShape {
  landlordName: string;
  contractNo: string;
  leasePaymentType: LeasePaymentType;
  leaseInstallments: { id: string; amount: string; dueDate: string; note: string }[];
  rentAmount: string;
  contractIssue: string;
  contractExpiry: string;
}

interface Props {
  form: HousingFormLeaseShape;
  setForm: React.Dispatch<React.SetStateAction<HousingFormLeaseShape & Record<string, unknown>>>;
  labelClass: string;
  inputClass: string;
  t: (k: string) => string;
  pendingDocs: { sectionKey: string; sectionLabel: string; sourcePath: string; customName: string }[];
  setPendingDocs: React.Dispatch<
    React.SetStateAction<{ sectionKey: string; sectionLabel: string; sourcePath: string; customName: string }[]>
  >;
  setDocModal: React.Dispatch<
    React.SetStateAction<{ sectionKey: string; sectionLabel: string; sourcePath: string; customName: string } | null>
  >;
}

export function AddHousingLeaseContractSection({
  form,
  setForm,
  labelClass,
  inputClass,
  t,
  pendingDocs,
  setPendingDocs,
  setDocModal,
}: Props) {
  return (
    <>
      <hr className="border-secondary-gray/50" />
      <h3 className="text-primary-gold font-medium">{t('housing.addModal.contractData')}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('housing.addModal.landlordName')}</label>
          <input
            type="text"
            value={form.landlordName}
            onChange={(e) => setForm((f) => ({ ...f, landlordName: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t('housing.addModal.contractNoLabel')}</label>
          <input
            type="text"
            value={form.contractNo}
            onChange={(e) => setForm((f) => ({ ...f, contractNo: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>{t('housing.addModal.paymentType')}</label>
        <select
          value={form.leasePaymentType}
          onChange={(e) => {
            const v = e.target.value as LeasePaymentType;
            setForm((f) => ({
              ...f,
              leasePaymentType: v,
              leaseInstallments:
                v === 'multiple' && f.leaseInstallments.length === 0
                  ? [{ id: `i${Date.now()}`, amount: '', dueDate: '', note: '' }]
                  : f.leaseInstallments,
            }));
          }}
          className={inputClass}
        >
          <option value="single">{t('housing.addModal.singlePayment')}</option>
          <option value="multiple">{t('housing.addModal.multiplePayments')}</option>
        </select>
      </div>

      {form.leasePaymentType === 'single' ? (
        <div>
          <label className={labelClass}>{t('housing.addModal.contractValueLabel')}</label>
          <input
            type="number"
            step="0.01"
            value={form.rentAmount}
            onChange={(e) => setForm((f) => ({ ...f, rentAmount: e.target.value }))}
            className={inputClass}
          />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-dark-charcoal">{t('housing.addModal.installmentsLabel')}</span>
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  leaseInstallments: [...f.leaseInstallments, { id: `i${Date.now()}`, amount: '', dueDate: '', note: '' }],
                }))
              }
              className="flex items-center gap-1 text-sm text-primary-gold hover:underline"
            >
              <Plus size={14} /> {t('housing.addModal.addInstallment')}
            </button>
          </div>
          <div className="space-y-2 border border-secondary-gray rounded-lg p-3 bg-white">
            {form.leaseInstallments.map((inst, idx) => (
              <div key={inst.id} className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-dark-charcoal/70 w-20 shrink-0">#{idx + 1}</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder={t('housing.addModal.amountPlaceholder')}
                  value={inst.amount}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      leaseInstallments: f.leaseInstallments.map((x) =>
                        x.id === inst.id ? { ...x, amount: e.target.value } : x
                      ),
                    }))
                  }
                  className="flex-1 min-w-[100px] px-3 py-2 border border-secondary-gray rounded-lg text-sm"
                />
                <DatePicker
                  value={inst.dueDate}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      leaseInstallments: f.leaseInstallments.map((x) =>
                        x.id === inst.id ? { ...x, dueDate: v || '' } : x
                      ),
                    }))
                  }
                  placeholder={t('housing.addModal.dueDatePlaceholder')}
                  className="flex-1 min-w-[140px]"
                />
                <input
                  type="text"
                  placeholder={t('housing.addModal.notesOptional')}
                  value={inst.note}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      leaseInstallments: f.leaseInstallments.map((x) =>
                        x.id === inst.id ? { ...x, note: e.target.value } : x
                      ),
                    }))
                  }
                  className="flex-1 min-w-[120px] px-3 py-2 border border-secondary-gray rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      leaseInstallments: f.leaseInstallments.filter((x) => x.id !== inst.id),
                    }))
                  }
                  className="p-1 text-alert-red hover:bg-alert-red/10 rounded shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-sm text-dark-charcoal/70 mt-2">
            {t('housing.addModal.totalContractValue')}:{' '}
            <strong>
              {form.leaseInstallments
                .reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
                .toLocaleString('en', { minimumFractionDigits: 0 })}{' '}
              {t('housing.aed')}
            </strong>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('housing.issueDate')}</label>
          <DatePicker
            value={form.contractIssue}
            onChange={(v) => setForm((f) => ({ ...f, contractIssue: v || '' }))}
            placeholder={t('housing.addModal.optionalPlaceholder')}
          />
        </div>
        <div>
          <label className={labelClass}>{t('housing.expiryDate')}</label>
          <DatePicker
            value={form.contractExpiry}
            onChange={(v) => setForm((f) => ({ ...f, contractExpiry: v || '' }))}
            placeholder={t('housing.addModal.optionalPlaceholder')}
          />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={async () => {
            const res = await window.electronAPI?.fileSelectDocument?.();
            if (res?.success && res?.filePath)
              setDocModal({
                sectionKey: 'lease',
                sectionLabel: t('housing.addModal.leaseSection'),
                sourcePath: res.filePath,
                customName: '',
              });
            else if (!res?.canceled) toast.error(res?.error || 'فشل اختيار الملف');
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm"
        >
          <Upload size={16} /> {t('housing.addModal.addDocuments')}
        </button>
        {pendingDocs
          .filter((d) => d.sectionKey === 'lease')
          .map((d, i) => (
            <span
              key={`lease-${i}-${d.sourcePath}`}
              className="mr-2 inline-flex items-center gap-1 mt-1 text-xs bg-secondary-gray/30 px-2 py-1 rounded"
            >
              <FileText size={12} /> {d.customName || d.sourcePath.replace(/^.*[/\\]/, '')}
              <button
                type="button"
                onClick={() =>
                  setPendingDocs((p) => {
                    const idx = p.indexOf(d);
                    if (idx === -1) return p;
                    return p.filter((_, j) => j !== idx);
                  })
                }
                className="text-alert-red hover:bg-alert-red/10 rounded p-0.5"
              >
                <X size={12} />
              </button>
            </span>
          ))}
      </div>
    </>
  );
}
