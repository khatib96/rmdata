import { useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { DatePicker } from '../../shared/DatePicker';
import { useAuthStore } from '../../../store/authStore';
import { MIN_TAX_YEAR, QUARTERS, type TaxPayment } from './entityProfileTypes';

export function VatPaymentsTab({
  entityId,
  payments,
  onSaved,
  t,
}: {
  entityId: number;
  payments: TaxPayment[];
  onSaved: () => void;
  t: (k: string) => string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [financialYear, setFinancialYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(1);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentDocPath, setPaymentDocPath] = useState<string | null>(null);
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const quarterInfo = QUARTERS.find((x) => x.q === quarter);
  const periodFrom = quarterInfo ? `${financialYear}-${quarterInfo.from}` : '';
  const periodTo = quarterInfo ? `${financialYear}-${quarterInfo.to}` : '';

  const handleAdd = async () => {
    const api = window.electronAPI;
    if (!api?.taxPaymentCreate || !paymentDate) return;
    const amt = amount === '' ? 0 : parseFloat(amount);
    if (isNaN(amt)) return;
    const ins = await api.taxPaymentCreate(sessionToken, {
      entityId,
      type: 'vat',
      financialYear,
      quarter,
      periodFrom,
      periodTo,
      amount: amt,
      paymentDate,
    });
    if (!ins.success) {
      toast.error(ins.error || 'TAX_PAYMENT_CREATE_FAILED');
      return;
    }
    if (paymentDocPath && api.documentSave) {
      const parts = paymentDocPath.replace(/\\/g, '/').split('/');
      const baseName = parts[parts.length - 1] || 'file';
      const relativePath = `Taxes/${entityId}/payments/${baseName}`;
      await api.documentSave({
        sourceFilePath: paymentDocPath,
        relativePath,
        customName: `وصل دفعة ض.ق.م.ض ${financialYear} Q${quarter}`,
        entityType: 'entity',
        entityId,
        section: 'payments',
      });
    }
    setShowForm(false);
    setAmount('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentDocPath(null);
    onSaved();
  };

  const handleDelete = async (paymentId: number) => {
    const api = window.electronAPI;
    if (!api?.taxPaymentDelete) return;
    const res = await api.taxPaymentDelete(sessionToken, paymentId);
    if (!res.success) {
      toast.error(res.error || 'TAX_PAYMENT_DELETE_FAILED');
      return;
    }
    onSaved();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium"
        >
          <Plus size={18} />
          {t('entities.addPayment')}
        </button>
      </div>
      {showForm && (
        <div className="p-4 border border-secondary-gray rounded-lg bg-light-background space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('entities.financialYear')}</label>
              <input
                type="number"
                value={financialYear}
                onChange={(e) => setFinancialYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('entities.quarter')}</label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg bg-white"
              >
                {QUARTERS.map((q) => (
                  <option key={q.q} value={q.q}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('entities.amountAedHint')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('entities.paymentDate')}</label>
              <DatePicker value={paymentDate} onChange={setPaymentDate} placeholder={t('entities.chooseDate')} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const res = await window.electronAPI?.fileSelectDocument?.();
                if (res?.success && res?.filePath) setPaymentDocPath(res.filePath);
                else if (!res?.canceled) toast.error(res?.error || t('entities.addModal.fileSelectFailed'));
              }}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm"
            >
              <Upload size={14} /> {t('entities.uploadDoc')}
            </button>
            {paymentDocPath && (
              <span className="text-sm text-dark-charcoal/80">
                {paymentDocPath.replace(/^.*[/\\]/, '')}
                <button type="button" onClick={() => setPaymentDocPath(null)} className="mr-1 text-alert-red hover:underline">
                  {t('entities.remove')}
                </button>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium">
              {t('entities.saveEdits')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setPaymentDocPath(null);
              }}
              className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20"
            >
              {t('entities.cancel')}
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-secondary-gray/20">
            <tr>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.financialYear')}</th>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.periodFromTo')}</th>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.amountAed')}</th>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.paymentDate')}</th>
              <th className="p-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-secondary-gray/50">
                <td className="p-3 font-medium">{p.financialYear}</td>
                <td className="p-3 text-dark-charcoal/80">
                  {p.periodFrom && p.periodTo ? `${p.periodFrom} — ${p.periodTo}` : `Q${p.quarter ?? '—'}`}
                </td>
                <td className="p-3 font-medium">{Number(p.amount).toLocaleString('en')}</td>
                <td className="p-3 text-dark-charcoal/80">{p.paymentDate}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-alert-red hover:bg-alert-red/10 rounded"
                    aria-label={t('entities.deleteConfirm')}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && !showForm && <p className="text-secondary-gray py-4">{t('entities.noPayments')}</p>}
      </div>
    </div>
  );
}

export function CorporatePaymentsTab({
  entityId,
  payments,
  onSaved,
  t,
}: {
  entityId: number;
  payments: TaxPayment[];
  onSaved: () => void;
  t: (k: string) => string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [financialYear, setFinancialYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentDocPath, setPaymentDocPath] = useState<string | null>(null);
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const handleAdd = async () => {
    const api = window.electronAPI;
    if (!api?.taxPaymentCreate || !paymentDate) return;
    const amt = amount === '' ? 0 : parseFloat(amount);
    if (isNaN(amt)) return;
    const ins = await api.taxPaymentCreate(sessionToken, {
      entityId,
      type: 'corporate',
      financialYear,
      amount: amt,
      paymentDate,
    });
    if (!ins.success) {
      toast.error(ins.error || 'TAX_PAYMENT_CREATE_FAILED');
      return;
    }
    if (paymentDocPath && api.documentSave) {
      const parts = paymentDocPath.replace(/\\/g, '/').split('/');
      const baseName = parts[parts.length - 1] || 'file';
      const relativePath = `Taxes/${entityId}/payments/${baseName}`;
      await api.documentSave({
        sourceFilePath: paymentDocPath,
        relativePath,
        customName: `وصل دفعة ض.شركات ${financialYear}`,
        entityType: 'entity',
        entityId,
        section: 'payments',
      });
    }
    setShowForm(false);
    setAmount('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentDocPath(null);
    onSaved();
  };

  const handleDelete = async (paymentId: number) => {
    const api = window.electronAPI;
    if (!api?.taxPaymentDelete) return;
    const res = await api.taxPaymentDelete(sessionToken, paymentId);
    if (!res.success) {
      toast.error(res.error || 'TAX_PAYMENT_DELETE_FAILED');
      return;
    }
    onSaved();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium"
        >
          <Plus size={18} />
          {t('entities.addPayment')}
        </button>
      </div>
      {showForm && (
        <div className="p-4 border border-secondary-gray rounded-lg bg-light-background space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('entities.financialYear')}</label>
              <input
                type="number"
                value={financialYear}
                onChange={(e) => setFinancialYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('entities.amountAedHint')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('entities.paymentDate')}</label>
              <DatePicker value={paymentDate} onChange={setPaymentDate} placeholder={t('entities.chooseDate')} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const res = await window.electronAPI?.fileSelectDocument?.();
                if (res?.success && res?.filePath) setPaymentDocPath(res.filePath);
                else if (!res?.canceled) toast.error(res?.error || t('entities.addModal.fileSelectFailed'));
              }}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-primary-gold/50 text-primary-gold hover:bg-primary-gold/10 text-sm"
            >
              <Upload size={14} /> {t('entities.uploadDoc')}
            </button>
            {paymentDocPath && (
              <span className="text-sm text-dark-charcoal/80">
                {paymentDocPath.replace(/^.*[/\\]/, '')}
                <button type="button" onClick={() => setPaymentDocPath(null)} className="mr-1 text-alert-red hover:underline">
                  {t('entities.remove')}
                </button>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} className="px-4 py-2 rounded-lg bg-primary-gold text-white hover:bg-accent-sand font-medium">
              {t('entities.saveEdits')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setPaymentDocPath(null);
              }}
              className="px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20"
            >
              {t('entities.cancel')}
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-secondary-gray/20">
            <tr>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.financialYear')}</th>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.amountAed')}</th>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.paymentDate')}</th>
              <th className="p-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-secondary-gray/50">
                <td className="p-3 font-medium">{p.financialYear}</td>
                <td className="p-3 font-medium">{Number(p.amount).toLocaleString('en')}</td>
                <td className="p-3 text-dark-charcoal/80">{p.paymentDate}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-alert-red hover:bg-alert-red/10 rounded"
                    aria-label={t('entities.deleteConfirm')}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && !showForm && <p className="text-secondary-gray py-4">{t('entities.noPayments')}</p>}
      </div>
    </div>
  );
}

export function TaxSummaryTab({
  vatPayments,
  corporatePayments,
  t,
}: {
  vatPayments: TaxPayment[];
  corporatePayments: TaxPayment[];
  t: (k: string) => string;
}) {
  const currentYear = new Date().getFullYear();
  const [yearFrom, setYearFrom] = useState(Math.max(MIN_TAX_YEAR, currentYear - 2));
  const [yearTo, setYearTo] = useState(currentYear);

  const years: number[] = [];
  for (let y = Math.min(yearFrom, yearTo); y <= Math.max(yearFrom, yearTo); y++) years.push(y);

  const vatByYearQuarter: Record<number, Record<number, number>> = {};
  years.forEach((y) => {
    vatByYearQuarter[y] = { 1: 0, 2: 0, 3: 0, 4: 0 };
  });
  vatPayments.forEach((p) => {
    if (years.includes(p.financialYear) && p.quarter != null) {
      vatByYearQuarter[p.financialYear][p.quarter as 1 | 2 | 3 | 4] =
        (vatByYearQuarter[p.financialYear]?.[p.quarter as 1 | 2 | 3 | 4] ?? 0) + Number(p.amount);
    }
  });

  const corporateByYear: Record<number, number> = {};
  years.forEach((y) => {
    corporateByYear[y] = 0;
  });
  corporatePayments.forEach((p) => {
    if (years.includes(p.financialYear)) corporateByYear[p.financialYear] += Number(p.amount);
  });

  let totalVat = 0;
  let totalCorporate = 0;
  years.forEach((y) => {
    totalVat +=
      (vatByYearQuarter[y]?.[1] ?? 0) +
      (vatByYearQuarter[y]?.[2] ?? 0) +
      (vatByYearQuarter[y]?.[3] ?? 0) +
      (vatByYearQuarter[y]?.[4] ?? 0);
    totalCorporate += corporateByYear[y] ?? 0;
  });
  const grandTotal = totalVat + totalCorporate;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg border border-secondary-gray bg-light-background">
        <label className="text-sm font-medium text-dark-charcoal">{t('entities.financialYearFilter')}</label>
        <div className="flex items-center gap-2">
          <select
            value={yearFrom}
            onChange={(e) => setYearFrom(parseInt(e.target.value, 10))}
            className="min-w-[5rem] px-3 py-2 border border-secondary-gray rounded-lg bg-white text-dark-charcoal"
          >
            {Array.from({ length: currentYear - MIN_TAX_YEAR + 1 }, (_, i) => MIN_TAX_YEAR + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="text-dark-charcoal/70">—</span>
          <select
            value={yearTo}
            onChange={(e) => setYearTo(parseInt(e.target.value, 10))}
            className="min-w-[5rem] px-3 py-2 border border-secondary-gray rounded-lg bg-white text-dark-charcoal"
          >
            {Array.from({ length: currentYear - MIN_TAX_YEAR + 1 }, (_, i) => MIN_TAX_YEAR + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border border-secondary-gray rounded-lg overflow-hidden">
        <h4 className="p-3 bg-primary-gold/10 text-primary-gold font-bold border-b border-secondary-gray">{t('entities.vatByQuarter')}</h4>
        <table className="w-full text-right">
          <thead className="bg-secondary-gray/20">
            <tr>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.year')}</th>
              <th className="p-3 text-dark-charcoal font-medium">Q1</th>
              <th className="p-3 text-dark-charcoal font-medium">Q2</th>
              <th className="p-3 text-dark-charcoal font-medium">Q3</th>
              <th className="p-3 text-dark-charcoal font-medium">Q4</th>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.total')}</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const q1 = vatByYearQuarter[y]?.[1] ?? 0;
              const q2 = vatByYearQuarter[y]?.[2] ?? 0;
              const q3 = vatByYearQuarter[y]?.[3] ?? 0;
              const q4 = vatByYearQuarter[y]?.[4] ?? 0;
              const sub = q1 + q2 + q3 + q4;
              return (
                <tr key={y} className="border-t border-secondary-gray/50">
                  <td className="p-3 font-medium text-dark-charcoal">{y}</td>
                  <td className="p-3 text-dark-charcoal/80">{q1.toLocaleString('en')}</td>
                  <td className="p-3 text-dark-charcoal/80">{q2.toLocaleString('en')}</td>
                  <td className="p-3 text-dark-charcoal/80">{q3.toLocaleString('en')}</td>
                  <td className="p-3 text-dark-charcoal/80">{q4.toLocaleString('en')}</td>
                  <td className="p-3 font-medium text-primary-gold">{sub.toLocaleString('en')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border border-secondary-gray rounded-lg overflow-hidden">
        <h4 className="p-3 bg-primary-gold/10 text-primary-gold font-bold border-b border-secondary-gray">{t('entities.corporateByYear')}</h4>
        <table className="w-full text-right">
          <thead className="bg-secondary-gray/20">
            <tr>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.year')}</th>
              <th className="p-3 text-dark-charcoal font-medium">{t('entities.amountAed')}</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y} className="border-t border-secondary-gray/50">
                <td className="p-3 font-medium text-dark-charcoal">{y}</td>
                <td className="p-3 font-medium text-primary-gold">{(corporateByYear[y] ?? 0).toLocaleString('en')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-lg border-2 border-primary-gold bg-primary-gold/5">
        <p className="text-dark-charcoal font-bold text-lg">
          {t('entities.totalTaxPaid')}:{' '}
          <span className="text-primary-gold">
            {grandTotal.toLocaleString('en')} {t('entities.aed')}
          </span>
        </p>
      </div>
    </div>
  );
}
