import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ChevronLeft, CheckCircle, AlertTriangle, AlertCircle, Filter, Plus, RefreshCw } from 'lucide-react';
import { ViewModeToggle } from '../shared/ViewModeToggle';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { usePermissions } from '../../hooks/usePermissions';
import { useExpiryUiSettings } from '../../hooks/useExpiryUiSettings';
import AddHousingModal from './AddHousingModal';
import { HOUSING_ICON_MAP } from '../Icons/HousingIcons';
import { HOUSING_TYPES, OWNED_BY_OPTIONS } from '../../constants/housing';
import { UAE_EMIRATES, getEmirateLabel } from '../../constants/uae';
import { useLanguageStore } from '../../store/languageStore';
import { dbQuery } from '../../services/dbClient';

type HousingFilterBy = '' | 'emirate' | 'housingType' | 'ownedBy' | 'branch';

interface HousingRow {
  id: number;
  code?: string;
  name: string;
  housingType: string;
  ownedBy: string;
  emirate?: string;
  address?: string;
  landlordName?: string;
  tenantDisplayName?: string;
  contractNo?: string;
  contractIssue?: string;
  contractExpiry?: string;
  rentAmount?: number;
  installmentsCount?: number;
  branchId?: number;
  branchName?: string;
  status?: string;
  paidCount?: number;
  occupantsCount?: number;
}

function getDaysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const HousingUnitGridCard = memo(function HousingUnitGridCard({
  u,
  onOpen,
  expiryWarningDays,
  showGreenExpiry,
  showYellowExpiry,
  t,
}: {
  u: HousingRow;
  onOpen: (id: number) => void;
  expiryWarningDays: number;
  showGreenExpiry: boolean;
  showYellowExpiry: boolean;
  t: TFunction;
}) {
  const daysUntil = getDaysUntil(u.contractExpiry);
  const contractStatus: 'ok' | 'warning' | 'expired' =
    daysUntil == null ? 'ok' : daysUntil < 0 ? 'expired' : daysUntil <= expiryWarningDays ? 'warning' : 'ok';
  const shouldShowExpiryBadge =
    contractStatus === 'expired' || (contractStatus === 'ok' ? showGreenExpiry : showYellowExpiry);
  const paidStr =
    u.paidCount != null && u.installmentsCount != null
      ? `${u.paidCount}/${u.installmentsCount} ${t('housing.paidOf')}`
      : '—';
  const Icon = HOUSING_ICON_MAP[u.housingType as keyof typeof HOUSING_ICON_MAP] || HOUSING_ICON_MAP['labour'];
  return (
    <div
      onClick={() => onOpen(u.id)}
      className="relative bg-white p-4 border border-secondary-gray/50 rounded-lg hover:border-primary-gold/50 hover:shadow-sm transition-all cursor-pointer flex flex-col"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-primary-gold/10">
          <Icon size={24} className="text-primary-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-primary-gold text-lg truncate">{u.name}</h3>
          {u.code && <span className="text-xs text-dark-charcoal/70 font-mono">{u.code}</span>}
          <p className="text-sm text-dark-charcoal/70">
            {t(`housing.types.${u.housingType === 'family' ? 'personal' : u.housingType}`)} · {t(`housing.ownedByOptions.${u.ownedBy}`)}
          </p>
        </div>
      </div>
      {u.contractExpiry && shouldShowExpiryBadge && (
        <div
          className={`flex items-center gap-2 text-xs mt-2 ${
            contractStatus === 'expired' ? 'text-alert-red' : contractStatus === 'warning' ? 'text-yellow-700' : 'text-success-green'
          }`}
        >
          {contractStatus === 'ok' && <CheckCircle size={14} className="shrink-0" />}
          {contractStatus === 'warning' && <AlertTriangle size={14} className="shrink-0" />}
          {contractStatus === 'expired' && <AlertCircle size={14} className="shrink-0" />}
          <span>
            {t('housing.contract')}:{' '}
            {daysUntil != null && daysUntil < 0
              ? t('housing.contractExpiredDays', { count: Math.abs(daysUntil) })
              : daysUntil != null && daysUntil <= expiryWarningDays
                ? t('housing.contractExpiresIn', { count: daysUntil })
                : t('housing.contractValid')}
          </span>
        </div>
      )}
      <p className="text-xs text-dark-charcoal/60 mt-1">
        {t('housing.installments')}: {paidStr}
      </p>
      {u.occupantsCount != null && u.occupantsCount > 0 && (
        <p className="text-xs text-dark-charcoal/60">
          {t('housing.occupants')}: {u.occupantsCount}
        </p>
      )}
    </div>
  );
});

const HousingUnitTableRow = memo(function HousingUnitTableRow({
  u,
  onOpen,
  expiryWarningDays,
  showGreenExpiry,
  showYellowExpiry,
  t,
}: {
  u: HousingRow;
  onOpen: (id: number) => void;
  expiryWarningDays: number;
  showGreenExpiry: boolean;
  showYellowExpiry: boolean;
  t: TFunction;
}) {
  const daysUntil = getDaysUntil(u.contractExpiry);
  const contractStatus = daysUntil == null ? 'ok' : daysUntil < 0 ? 'expired' : daysUntil <= expiryWarningDays ? 'warning' : 'ok';
  const shouldShowExpiryBadge =
    contractStatus === 'expired' || (contractStatus === 'ok' ? showGreenExpiry : showYellowExpiry);
  const paidStr =
    u.paidCount != null && u.installmentsCount != null ? `${u.paidCount}/${u.installmentsCount}` : '—';
  const Icon = HOUSING_ICON_MAP[u.housingType as keyof typeof HOUSING_ICON_MAP] || HOUSING_ICON_MAP['labour'];
  return (
    <tr
      className="border-t border-secondary-gray/30 hover:bg-accent-sand/20 transition-colors cursor-pointer"
      onClick={() => onOpen(u.id)}
    >
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <Icon size={20} className="shrink-0 text-primary-gold" />
          <span className="font-medium text-dark-charcoal">{u.name}</span>
          {u.code && <span className="text-xs text-dark-charcoal/70 font-mono">{u.code}</span>}
        </div>
      </td>
      <td className="py-4 px-4 text-dark-charcoal">{t(`housing.types.${u.housingType === 'family' ? 'personal' : u.housingType}`)}</td>
      <td className="py-4 px-4 text-dark-charcoal">{t(`housing.ownedByOptions.${u.ownedBy}`)}</td>
      <td className="py-4 px-4">
        {u.contractExpiry ? (
          shouldShowExpiryBadge ? (
            <span className={contractStatus === 'expired' ? 'text-alert-red' : contractStatus === 'warning' ? 'text-yellow-700' : ''}>
              {u.contractExpiry}
              {daysUntil != null && contractStatus === 'warning' && (
                <span className="text-xs block">({t('housing.daysLeft', { count: daysUntil })})</span>
              )}
            </span>
          ) : (
            <span className="text-secondary-gray text-sm">—</span>
          )
        ) : (
          '—'
        )}
      </td>
      <td className="py-4 px-4 text-dark-charcoal">{paidStr}</td>
      <td className="py-4 px-4 text-dark-charcoal">{u.branchName || '—'}</td>
      <td className="py-4 px-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(u.id);
          }}
          className="p-2 hover:bg-secondary-gray/30 rounded-lg"
        >
          <ChevronLeft size={18} className="rotate-180" />
        </button>
      </td>
    </tr>
  );
});

export default function Housing() {
  const { t } = useTranslation();
  const lang = useLanguageStore((s) => s.language);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { can } = usePermissions();
  const { expiryWarningDays, showGreenExpiry, showYellowExpiry } = useExpiryUiSettings();
  const [units, setUnits] = useState<HousingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewMode, setViewMode] = usePersistedViewMode('housing_viewMode', 'grid');
  const [filterBy, setFilterBy] = useState<HousingFilterBy>('');
  const [filterValue, setFilterValue] = useState('');
  const [filterOptions, setFilterOptions] = useState<{ id: string; label: string }[]>([]);

  const loadUnits = useCallback(
    async (signal?: AbortSignal) => {
      try {
        if (!window.electronAPI?.dbQuery) {
          setUnits([]);
          return;
        }
        let extraWhere = '';
        const params: unknown[] = [];
        if (filterBy && filterValue) {
          if (filterBy === 'emirate') {
            extraWhere = ' AND h.emirate = ?';
            params.push(filterValue);
          } else if (filterBy === 'housingType') {
            extraWhere = ' AND h.housingType = ?';
            params.push(filterValue);
          } else if (filterBy === 'ownedBy') {
            extraWhere = ' AND h.ownedBy = ?';
            params.push(filterValue);
          } else if (filterBy === 'branch') {
            extraWhere = ' AND h.branchId = ?';
            params.push(filterValue);
          }
        }
        const baseWhere = " (h.status IS NULL OR h.status != 'archived') ";
        const res = await dbQuery<HousingRow[]>(
          `SELECT h.id, h.code, h.name, h.housingType, h.ownedBy, h.emirate, h.address, h.landlordName, h.tenantDisplayName,
                h.contractNo, h.contractIssue, h.contractExpiry, h.rentAmount, h.installmentsCount, h.branchId, h.status,
                b.name as branchName,
                (SELECT COUNT(*) FROM housing_installments i WHERE i.housingId = h.id AND i.paid = 1) as paidCount,
                (SELECT COUNT(*) FROM housing_occupants o WHERE o.housingUnitId = h.id AND (o.toDate IS NULL OR o.toDate >= date('now'))) as occupantsCount
         FROM housing_units h
         LEFT JOIN branches b ON h.branchId = b.id
         WHERE ${baseWhere} ${extraWhere}
         ORDER BY h.name`,
          params.length ? params : undefined,
          { signal }
        );
        if (signal?.aborted) return;
        setUnits(res?.data ?? []);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        setUnits([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [filterBy, filterValue]
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadUnits(ac.signal);
    return () => ac.abort();
  }, [loadUnits]);

  const loadFilterOptions = useCallback(
    async (signal?: AbortSignal) => {
      if (!filterBy || !window.electronAPI?.dbQuery) {
        setFilterOptions([]);
        return;
      }
      try {
        if (filterBy === 'emirate') {
          if (signal?.aborted) return;
          setFilterOptions(UAE_EMIRATES.map((e) => ({ id: e.value, label: getEmirateLabel(e.value, lang) })));
          return;
        }
        if (filterBy === 'housingType') {
          if (signal?.aborted) return;
          setFilterOptions(HOUSING_TYPES.map((x) => ({ id: x.value, label: t(`housing.types.${x.value}`) })));
          return;
        }
        if (filterBy === 'ownedBy') {
          if (signal?.aborted) return;
          setFilterOptions(OWNED_BY_OPTIONS.map((o) => ({ id: o.value, label: t(`housing.ownedByOptions.${o.value}`) })));
          return;
        }
        if (filterBy === 'branch') {
          const res = await dbQuery<{ id: number; name: string }[]>(
            "SELECT id, name FROM branches WHERE (status IS NULL OR status != 'archived') ORDER BY name",
            undefined,
            { signal }
          );
          if (signal?.aborted) return;
          const rows = res?.data ?? [];
          setFilterOptions(rows.map((r) => ({ id: String(r.id), label: r.name })));
        }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        setFilterOptions([]);
      }
    },
    [filterBy, lang, t]
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadFilterOptions(ac.signal);
    return () => ac.abort();
  }, [loadFilterOptions]);

  const openHousing = useCallback(
    (id: number) => {
      navigate(`/dashboard/housing/${id}`);
    },
    [navigate]
  );

  if (!can('housing', 'view')) return <p className="p-8 text-center text-secondary-gray">{t('common.noPermission', 'ليس لديك صلاحية الوصول')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-dark-charcoal">{t('housing.title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-dark-charcoal/70" />
            <select
              value={filterBy}
              onChange={(e) => { setFilterBy(e.target.value as HousingFilterBy); setFilterValue(''); }}
              className="rounded-lg border border-secondary-gray px-3 py-2 text-sm bg-white min-w-[140px]"
            >
              <option value="">{t('housing.noFilter')}</option>
              <option value="emirate">{t('housing.filterEmirate')}</option>
              <option value="housingType">{t('housing.filterHousingType')}</option>
              <option value="ownedBy">{t('housing.filterOwnedBy')}</option>
              <option value="branch">{t('housing.filterBranch')}</option>
            </select>
            {filterBy && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="rounded-lg border border-secondary-gray px-3 py-2 text-sm bg-white min-w-[160px]"
              >
                <option value="">{t('housing.choose')}</option>
                {filterOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
          <button
            type="button"
            onClick={() => void loadUnits()}
            className="p-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/30 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title={t('housing.refreshTitle')}
          >
            <RefreshCw size={18} />
          </button>
          {!isMobile && <ViewModeToggle value={viewMode} onChange={setViewMode} />}
          {can('housing', 'create') && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="bg-primary-gold text-white px-6 py-2 rounded-lg hover:bg-accent-sand transition-colors min-h-[44px] flex items-center gap-2"
            >
              <Plus size={20} />
              {t('housing.addUnit')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <p className="text-secondary-gray">{t('housing.loading')}</p>
        ) : units.length === 0 ? (
          <p className="text-secondary-gray">{t('housing.noUnits')}</p>
        ) : viewMode === 'grid' || isMobile ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {units.map((u) => (
              <HousingUnitGridCard
                key={u.id}
                u={u}
                onOpen={openHousing}
                expiryWarningDays={expiryWarningDays}
                showGreenExpiry={showGreenExpiry}
                showYellowExpiry={showYellowExpiry}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-light-background">
                <tr>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('housing.tableUnit')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('housing.tableUnitType')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('housing.tableOwnedBy')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('housing.tableContractExpiry')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('housing.installments')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('housing.tableBranch')}</th>
                  <th className="py-4 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <HousingUnitTableRow
                    key={u.id}
                    u={u}
                    onOpen={openHousing}
                    expiryWarningDays={expiryWarningDays}
                    showGreenExpiry={showGreenExpiry}
                    showYellowExpiry={showYellowExpiry}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddHousingModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => void loadUnits()}
      />
    </div>
  );
}
