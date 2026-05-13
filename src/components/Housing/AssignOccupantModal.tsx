import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { logActivity } from '../../utils/activityLog';
import { useAuthStore } from '../../store/authStore';

interface AssignOccupantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  housingUnitId: number;
  housingUnitName: string;
  emirate?: string;
}

export default function AssignOccupantModal({
  isOpen,
  onClose,
  onSuccess,
  housingUnitId,
  housingUnitName,
  emirate,
}: AssignOccupantModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [employers, setEmployers] = useState<{ id: number; name: string; code?: string }[]>([]);
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [employerId, setEmployerId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !window.electronAPI?.dbQuery) return;
    (async () => {
      let query = `
        SELECT e.id, e.name 
        FROM employees e
        LEFT JOIN branches b ON e.workBranchId = b.id
        WHERE (e.status NOT IN ('archived', 'terminated', 'visa_cancelled') OR e.status IS NULL)
          AND (e.loanType IS NULL OR e.loanType != 'external')
          AND e.id NOT IN (
            SELECT employeeId 
            FROM housing_occupants 
            WHERE housingUnitId = ? AND employeeId IS NOT NULL 
              AND (toDate IS NULL OR toDate >= date('now'))
          )
      `;
      const params: (number | string)[] = [housingUnitId];
      if (emirate) {
        query += ` AND (b.emirate = ? OR b.emirate IS NULL OR e.workBranchId IS NULL)`;
        params.push(emirate);
      }
      query += ` ORDER BY e.name`;
      const res = await window.electronAPI.dbQuery(query, params);
      setEmployees((res?.data ?? []) as { id: number; name: string }[]);

      const empRes = await window.electronAPI.dbQuery(
        `SELECT id, fullName as name, code FROM employers
         WHERE (status IS NULL OR status != 'archived')
           AND id NOT IN (
             SELECT employerId FROM housing_occupants
             WHERE housingUnitId = ? AND employerId IS NOT NULL AND (toDate IS NULL OR toDate >= date('now'))
           )
         ORDER BY fullName`,
        [housingUnitId]
      );
      setEmployers((empRes?.data ?? []) as { id: number; name: string; code?: string }[]);
    })();
  }, [isOpen, housingUnitId, emirate]);

  const reset = () => {
    setEmployeeId('');
    setEmployerId('');
    setName('');
    setFromDate('');
    setToDate('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = employeeId
      ? (employees.find((e) => e.id === Number(employeeId))?.name ?? '')
      : employerId
        ? (employers.find((o) => o.id === Number(employerId))?.name ?? '')
        : name.trim();
    if (!displayName) {
      setError(t('housing.assignModal.selectEmployeeOrEmployerOrName'));
      return;
    }
    if (!fromDate) {
      setError(t('housing.assignModal.fromDateRequired'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await window.electronAPI?.dbQuery?.(
        `INSERT INTO housing_occupants (housingUnitId, employeeId, employerId, name, role, fromDate, toDate)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          housingUnitId,
          employeeId || null,
          employerId || null,
          (employeeId || employerId) ? null : name.trim(),
          'occupant',
          fromDate || null,
          toDate || null,
        ]
      );
      await logActivity({
        module: 'housing',
        action: 'assign_occupant',
        entityType: 'housing',
        entityId: housingUnitId,
        details: `assignOccupant::${displayName}::${housingUnitName}`,
        performedByUserId: user?.id,
        performedByUsername: user?.username,
        performedByUserCode: user?.username,
      });
      handleClose();
      onSuccess();
    } catch {
      setError(t('housing.assignModal.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-secondary-gray">
          <h2 className="text-lg font-bold text-dark-charcoal">{t('housing.assignModal.title')}</h2>
          <button type="button" onClick={handleClose} className="p-2 rounded-lg hover:bg-secondary-gray/30">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
          <p className="text-sm text-dark-charcoal/70">{t('housing.assignModal.unit')}: {housingUnitName}</p>
          <div>
            <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('housing.assignModal.employeeOptional')}</label>
            <select
              value={employeeId === '' ? '' : String(employeeId)}
              onChange={(e) => {
                const v = e.target.value === '' ? '' : Number(e.target.value);
                setEmployeeId(v);
                if (v) {
                  setEmployerId('');
                  setName('');
                }
              }}
              className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-dark-charcoal"
            >
              <option value="">{t('housing.assignModal.noEmployee')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('housing.assignModal.employerOptional')}</label>
            <select
              value={employerId === '' ? '' : String(employerId)}
              onChange={(e) => {
                const v = e.target.value === '' ? '' : Number(e.target.value);
                setEmployerId(v);
                if (v) {
                  setEmployeeId('');
                  setName('');
                }
              }}
              className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-dark-charcoal"
            >
              <option value="">{t('housing.assignModal.noEmployer')}</option>
              {employers.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} {emp.code && `(${emp.code})`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('housing.assignModal.nameIfManual')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!employeeId || !!employerId}
              className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-dark-charcoal disabled:bg-gray-100"
              placeholder={t('housing.assignModal.occupantNamePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('housing.assignModal.fromDateLabel')}</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-dark-charcoal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('housing.assignModal.toDateLabel')}</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-dark-charcoal"
              />
            </div>
          </div>
          {error && <p className="text-sm text-alert-red">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-primary-gold text-white font-medium hover:bg-accent-sand disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button type="button" onClick={handleClose} className="px-4 py-2.5 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20">
              {t('housing.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
