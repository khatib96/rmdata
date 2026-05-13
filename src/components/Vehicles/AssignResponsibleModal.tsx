import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { logActivity } from '../../utils/activityLog';

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

interface AssignResponsibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  vehicleId: number;
  vehiclePlate: string;
  currentEmployeeId: number | null;
  currentEmployerId: number | null;
  currentResponsibleName: string | null;
}

export default function AssignResponsibleModal({
  isOpen,
  onClose,
  onSaved,
  vehicleId,
  vehiclePlate,
  currentEmployeeId,
  currentEmployerId,
  currentResponsibleName,
}: AssignResponsibleModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [isDriver, setIsDriver] = useState(true);
  const [employeeList, setEmployeeList] = useState<EmployeeOption[]>([]);
  const [employerList, setEmployerList] = useState<EmployerOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(currentEmployeeId);
  const [selectedEmployerId, setSelectedEmployerId] = useState<number | null>(currentEmployerId);
  const [manualName, setManualName] = useState(
    currentResponsibleName && !currentEmployeeId && !currentEmployerId ? currentResponsibleName : ''
  );
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !window.electronAPI?.dbQuery) return;
    setSelectedEmployeeId(currentEmployeeId);
    setSelectedEmployerId(currentEmployerId);
    setManualName(
      currentResponsibleName && !currentEmployeeId && !currentEmployerId ? currentResponsibleName : ''
    );
    setError('');
    const load = async () => {
      if (isDriver) {
        const res = await window.electronAPI.dbQuery(
          `SELECT id, name, code FROM employees
           WHERE (status IS NULL OR status NOT IN ('terminated', 'archived', 'visa_cancelled'))
           AND (profession LIKE '%سائق%' OR professionPerContract LIKE '%سائق%' OR professionKeys LIKE '%driver%')
           ORDER BY name`
        );
        setEmployeeList((res?.data ?? []) as EmployeeOption[]);
        setEmployerList([]);
      } else {
        const empRes = await window.electronAPI.dbQuery(
          `SELECT id, name, code FROM employees WHERE (status IS NULL OR status NOT IN ('terminated', 'archived', 'visa_cancelled')) ORDER BY name`
        );
        setEmployeeList((empRes?.data ?? []) as EmployeeOption[]);
        const ownRes = await window.electronAPI.dbQuery(
          `SELECT id, fullName as name, code FROM employers WHERE (status IS NULL OR status != 'archived') ORDER BY fullName`
        );
        setEmployerList((ownRes?.data ?? []) as EmployerOption[]);
      }
    };
    load();
  }, [isOpen, isDriver, currentEmployeeId, currentEmployerId, currentResponsibleName]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employeeList;
    return employeeList.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        (e.code && e.code.toLowerCase().includes(q))
    );
  }, [employeeList, search]);

  const filteredEmployers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employerList;
    return employerList.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        (e.code && e.code.toLowerCase().includes(q))
    );
  }, [employerList, search]);

  const handleSave = async () => {
    setError('');
    const employeeId = selectedEmployeeId;
    const employerId = selectedEmployerId;
    const name = employeeId
      ? (employeeList.find((e) => e.id === employeeId)?.name ?? '')
      : employerId
        ? (employerList.find((e) => e.id === employerId)?.name ?? '')
        : manualName.trim();
    if (!name) {
      setError(t('vehicles.assignModal.selectError'));
      return;
    }
    setLoading(true);
    try {
      if (!window.electronAPI?.dbQuery) {
        setError(t('vehicles.assignModal.dbUnavailable'));
        setLoading(false);
        return;
      }
      await window.electronAPI.dbQuery(
        'UPDATE vehicles SET responsibleEmployeeId = ?, responsibleEmployerId = ?, responsibleName = ? WHERE id = ?',
        [employeeId || null, employerId || null, name || null, vehicleId]
      );
      await logActivity({
        module: 'vehicle',
        action: 'assign_responsible',
        entityType: 'vehicle',
        entityId: vehicleId,
        details: `assignResponsible::${name}::${vehiclePlate || ''}`,
        performedByUserId: user?.id,
        performedByUsername: user?.username,
        performedByUserCode: user?.username,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('vehicles.assignModal.saveError'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="bg-primary-gold text-white p-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold">{t('vehicles.assignModal.title')}</h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded p-1">
            <X size={22} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-2 bg-alert-red/10 border border-alert-red text-alert-red rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-dark-charcoal font-medium">{t('vehicles.assignModal.isDriver')}</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDriver}
                onChange={(e) => {
                  setIsDriver(e.target.checked);
                  setSelectedEmployeeId(null);
                  setSelectedEmployerId(null);
                  setManualName('');
                  setSearch('');
                }}
                className="rounded border-secondary-gray text-primary-gold focus:ring-primary-gold"
              />
              {t('vehicles.assignModal.yesDriversOnly')}
            </label>
          </div>

          {isDriver ? (
            <div>
              <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('vehicles.assignModal.selectDriver')}</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('vehicles.assignModal.searchPlaceholder')}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg mb-2"
              />
              <div className="max-h-48 overflow-y-auto border border-secondary-gray rounded-lg">
                {filteredEmployees.length === 0 ? (
                  <p className="p-3 text-secondary-gray text-sm">لا توجد نتائج</p>
                ) : (
                  filteredEmployees.map((e) => (
                    <button
                      key={`emp-${e.id}`}
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeId(e.id);
                        setManualName('');
                      }}
                      className={`w-full text-right px-3 py-2 border-b border-secondary-gray/30 last:border-0 hover:bg-accent-sand/30 ${
                        selectedEmployeeId === e.id ? 'bg-primary-gold/10 text-primary-gold' : ''
                      }`}
                    >
                      {e.name} {e.code && <span className="text-xs text-dark-charcoal/70">({e.code})</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-dark-charcoal">{t('vehicles.assignModal.selectEmployeeOrEmployerOrName')}</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('vehicles.assignModal.searchPlaceholderShort')}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
              />
              {employeeList.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-dark-charcoal/70 mb-1">{t('vehicles.assignModal.employees')}</p>
                  <div className="max-h-32 overflow-y-auto border border-secondary-gray rounded-lg">
                    {filteredEmployees.map((e) => (
                      <button
                        key={`emp-${e.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeId(e.id);
                          setSelectedEmployerId(null);
                          setManualName('');
                        }}
                        className={`w-full text-right px-3 py-2 border-b border-secondary-gray/30 last:border-0 hover:bg-accent-sand/30 ${
                          selectedEmployeeId === e.id ? 'bg-primary-gold/10 text-primary-gold' : ''
                        }`}
                      >
                        {e.name} {e.code && <span className="text-xs text-dark-charcoal/70">({e.code})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {employerList.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-dark-charcoal/70 mb-1">{t('vehicles.assignModal.employers')}</p>
                  <div className="max-h-32 overflow-y-auto border border-secondary-gray rounded-lg">
                    {filteredEmployers.map((e) => (
                      <button
                        key={`own-${e.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedEmployerId(e.id);
                          setSelectedEmployeeId(null);
                          setManualName('');
                        }}
                        className={`w-full text-right px-3 py-2 border-b border-secondary-gray/30 last:border-0 hover:bg-accent-sand/30 ${
                          selectedEmployerId === e.id ? 'bg-primary-gold/10 text-primary-gold' : ''
                        }`}
                      >
                        {e.name} {e.code && <span className="text-xs text-dark-charcoal/70">({e.code})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input
                type="text"
                value={manualName}
                onChange={(e) => {
                  setManualName(e.target.value);
                  setSelectedEmployeeId(null);
                  setSelectedEmployerId(null);
                }}
                placeholder={t('vehicles.assignModal.manualPlaceholder')}
                className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
              />
            </div>
          )}
        </div>
        <div className="p-4 flex justify-end gap-2 border-t border-secondary-gray/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-secondary-gray rounded-lg text-dark-charcoal"
          >
            {t('vehicles.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !(selectedEmployeeId || selectedEmployerId || (!isDriver && manualName.trim()))}
            className="px-4 py-2 bg-primary-gold text-white rounded-lg disabled:opacity-50"
          >
            {loading ? t('vehicles.assignModal.saving') : t('vehicles.assignModal.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
