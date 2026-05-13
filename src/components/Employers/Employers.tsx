import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Plus, RefreshCw, ChevronLeft, CheckCircle, AlertTriangle, AlertCircle, Building2 } from 'lucide-react';
import AddEmployerModal from './AddEmployerModal';
import { getExpiryStatus } from '../../utils/expiryAlert';
import { ViewModeToggle } from '../shared/ViewModeToggle';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { usePermissions } from '../../hooks/usePermissions';
import { useExpiryUiSettings } from '../../hooks/useExpiryUiSettings';
import { EntityAvatar } from '../shared/EntityAvatar';
import { dbQuery } from '../../services/dbClient';

interface EmployerRow {
  id: number;
  code?: string;
  fullName: string;
  fullNameEn?: string;
  nationality?: string;
  phone?: string;
  passportExpiry?: string;
  emiratesIdExpiry?: string;
  status: string;
  imagePath?: string;
  branchCount?: number;
}

type EmployerExpiryRow = {
  label: string;
  date: string;
  info: ReturnType<typeof getExpiryStatus>;
};

function computeEmployerExpiries(
  emp: EmployerRow,
  t: TFunction,
  expiryWarningDays: number,
  showGreenExpiry: boolean,
  showYellowExpiry: boolean
): EmployerExpiryRow[] {
  const items: EmployerExpiryRow[] = [];
  if (emp.passportExpiry) {
    items.push({ label: t('employers.passport'), date: emp.passportExpiry, info: getExpiryStatus(emp.passportExpiry, expiryWarningDays) });
  }
  if (emp.emiratesIdExpiry) {
    items.push({ label: t('employers.emiratesId'), date: emp.emiratesIdExpiry, info: getExpiryStatus(emp.emiratesIdExpiry, expiryWarningDays) });
  }
  const filtered = items.filter((item) => {
    if (item.info.status === 'red') return true;
    if (item.info.status === 'green') return showGreenExpiry;
    return showYellowExpiry;
  });
  return filtered.sort((a, b) => (a.info.status === 'red' ? -1 : b.info.status === 'red' ? 1 : 0));
}

export default function Employers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { can } = usePermissions();
  const { expiryWarningDays, showGreenExpiry, showYellowExpiry } = useExpiryUiSettings();
  const [employers, setEmployers] = useState<EmployerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = usePersistedViewMode('employers_viewMode', 'grid');

  const loadEmployers = useCallback(
    async (signal?: AbortSignal) => {
      if (!window.electronAPI?.dbQuery) {
        setEmployers([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const sql = showArchived
          ? `SELECT id, code, fullName, fullNameEn, nationality, phone, passportExpiry, emiratesIdExpiry, status, photoPath as imagePath,
         (SELECT COUNT(DISTINCT branchId) FROM branch_employers WHERE employerId = employers.id) as branchCount
         FROM employers WHERE status = ? ORDER BY fullName`
          : `SELECT id, code, fullName, fullNameEn, nationality, phone, passportExpiry, emiratesIdExpiry, status, photoPath as imagePath,
         (SELECT COUNT(DISTINCT branchId) FROM branch_employers WHERE employerId = employers.id) as branchCount
         FROM employers WHERE (status IS NULL OR status != ?) ORDER BY fullName`;
        const res = await dbQuery<EmployerRow[]>(sql, ['archived'], { signal });
        if (signal?.aborted) return;
        setEmployers(res?.success && res?.data ? res.data : []);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        setEmployers([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [showArchived]
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadEmployers(ac.signal);
    return () => ac.abort();
  }, [loadEmployers]);

  const expiriesByEmployerId = useMemo(() => {
    const m = new Map<number, EmployerExpiryRow[]>();
    for (const emp of employers) {
      m.set(emp.id, computeEmployerExpiries(emp, t, expiryWarningDays, showGreenExpiry, showYellowExpiry));
    }
    return m;
  }, [employers, t, expiryWarningDays, showGreenExpiry, showYellowExpiry]);

  if (!can('employers', 'view')) return <p className="p-8 text-center text-secondary-gray">{t('common.noPermission', 'ليس لديك صلاحية الوصول')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-dark-charcoal">{t('employers.title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowArchived(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${showArchived ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-secondary-gray hover:bg-secondary-gray/20'}`}
          >
            {showArchived ? t('employers.showActive') : t('employers.showArchive')}
          </button>
          {!isMobile && <ViewModeToggle value={viewMode} onChange={setViewMode} />}
          <button
            type="button"
            onClick={() => void loadEmployers()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20 transition-colors"
            title={t('employers.refreshTitle')}
          >
            <RefreshCw size={18} />
          </button>
          {can('employers', 'create') && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 bg-primary-gold text-white px-6 py-2 rounded-lg hover:bg-accent-sand transition-colors"
            >
              <Plus size={20} /> {t('employers.addEmployer')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-secondary-gray">{t('common.loading')}</div>
        ) : employers.length === 0 ? (
          <div className="p-12 text-center">
            <img src="./icons/owner.png" alt="" className="mx-auto mb-4 w-12 h-12 opacity-30" />
            <p className="text-secondary-gray mb-4">{showArchived ? t('employers.noArchive') : t('employers.noEmployers')}</p>
            {!showArchived && can('employers', 'create') && (
              <button type="button" onClick={() => setAddModalOpen(true)} className="text-primary-gold hover:underline">{t('employers.addFirstEmployer')}</button>
            )}
          </div>
        ) : viewMode === 'grid' || isMobile ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 p-4">
            {employers.map((emp) => {
              const expiries = expiriesByEmployerId.get(emp.id) ?? [];
              const hasAlert = expiries.some((e) => e.info.status === 'red' || e.info.status === 'yellow' || e.info.status === 'orange');
              return (
                <div
                  key={emp.id}
                  onClick={() => navigate(`/dashboard/employers/${emp.id}`)}
                  className="bg-white p-3 pb-4 border border-secondary-gray/50 rounded-md hover:border-primary-gold/50 hover:shadow-sm transition-all cursor-pointer flex flex-col relative"
                >
                  {hasAlert && (
                    <div className="absolute top-3 left-3 z-10">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-alert-red/10 text-alert-red">{t('employers.alert')}</span>
                    </div>
                  )}
                  <div className="flex justify-center mb-3">
                    <EntityAvatar
                      imagePath={emp.imagePath}
                      className="w-16 h-16 rounded-full object-cover"
                      alt=""
                      fallback={
                        <div className="w-16 h-16 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-xl">
                          {emp.fullName?.charAt(0) || t('common.avatarFallback')}
                        </div>
                      }
                    />
                  </div>
                  <div className="flex flex-col items-center text-center flex-1">
                    <h3 className="font-bold text-primary-gold text-lg">{emp.fullName}</h3>
                    {emp.code && <span className="text-xs text-dark-charcoal/70 font-mono">{emp.code}</span>}
                    {emp.fullNameEn && <p className="text-xs text-dark-charcoal/50 mt-0.5">{emp.fullNameEn}</p>}
                    {emp.phone && <p className="text-sm text-dark-charcoal/70 mt-0.5" dir="ltr">{emp.phone}</p>}
                    <div className="flex items-center justify-center gap-1.5 mt-1.5 text-dark-charcoal/60">
                      <Building2 size={14} className="shrink-0" />
                      <span className="text-xs font-medium">{emp.branchCount ?? 0} {t('employers.branchesCount')}</span>
                    </div>
                  </div>
                  {expiries.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-secondary-gray/50 flex flex-col gap-1.5">
                      {expiries.map((item, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-center gap-2 text-xs ${
                            item.info.status === 'red' ? 'text-alert-red' : item.info.status === 'yellow' || item.info.status === 'orange' ? 'text-yellow-700' : 'text-success-green'
                          }`}
                        >
                          {item.info.status === 'green' && <CheckCircle size={14} className="shrink-0 text-success-green" />}
                          {(item.info.status === 'yellow' || item.info.status === 'orange') && <AlertTriangle size={14} className="shrink-0 text-yellow-600" />}
                          {item.info.status === 'red' && <AlertCircle size={14} className="shrink-0 text-alert-red" />}
                          <span>
                            {item.info.isExpired
                              ? `${item.label}: ${t('employers.expiryExpired', { count: item.info.daysLeft != null ? Math.abs(item.info.daysLeft) : 0 })}`
                              : item.info.daysLeft != null && item.info.daysLeft > 0
                                ? `${item.label}: ${t('employers.expiryInDays', { count: item.info.daysLeft })}`
                                : `${item.label}: ${item.info.label}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : !isMobile ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-light-background">
                <tr>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal">{t('employers.tableEmployer')}</th>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal">{t('employers.tablePhone')}</th>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal">{t('employers.tableBranches')}</th>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal">{t('employers.tableExpiryAlerts')}</th>
                  <th className="text-right py-4 px-4 font-medium text-dark-charcoal"></th>
                </tr>
              </thead>
              <tbody>
                {employers.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-t border-secondary-gray/30 hover:bg-accent-sand/20 transition-colors cursor-pointer"
                    onClick={() => navigate(`/dashboard/employers/${emp.id}`)}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <EntityAvatar
                          imagePath={emp.imagePath}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                          alt=""
                          fallback={
                            <div className="w-8 h-8 rounded-full bg-primary-gold/20 flex items-center justify-center text-primary-gold font-bold text-sm shrink-0">
                              {emp.fullName?.charAt(0) || t('common.avatarFallback')}
                            </div>
                          }
                        />
                        <div>
                          <p className="font-medium text-dark-charcoal">{emp.fullName}{emp.code ? ` (${emp.code})` : ''}</p>
                          {emp.fullNameEn && <p className="text-sm text-secondary-gray">{emp.fullNameEn}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4"><span className="text-dark-charcoal" dir="ltr">{emp.phone || '—'}</span></td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 text-dark-charcoal">
                        <Building2 size={16} className="shrink-0 text-primary-gold/70" />
                        {emp.branchCount ?? 0}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        {(expiriesByEmployerId.get(emp.id) ?? []).map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 text-xs ${
                              item.info.status === 'red' ? 'text-alert-red' : item.info.status === 'yellow' || item.info.status === 'orange' ? 'text-yellow-700' : 'text-success-green'
                            }`}
                          >
                            {item.info.status === 'green' && <CheckCircle size={14} className="shrink-0 text-success-green" />}
                            {(item.info.status === 'yellow' || item.info.status === 'orange') && <AlertTriangle size={14} className="shrink-0 text-yellow-600" />}
                            {item.info.status === 'red' && <AlertCircle size={14} className="shrink-0 text-alert-red" />}
                            <span>
                              {item.info.isExpired
                                ? `${item.label}: ${t('employers.expiryExpired', { count: item.info.daysLeft != null ? Math.abs(item.info.daysLeft) : 0 })}`
                                : item.info.daysLeft != null && item.info.daysLeft > 0
                                  ? `${item.label}: ${t('employers.expiryInDays', { count: item.info.daysLeft })}`
                                  : `${item.label}: ${item.info.label}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/employers/${emp.id}`); }}
                        className="p-2 hover:bg-secondary-gray/30 rounded-lg"
                      >
                        <ChevronLeft size={18} className="rotate-180" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <AddEmployerModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => void loadEmployers()}
      />
    </div>
  );
}
