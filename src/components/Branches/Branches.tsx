import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Phone, CheckCircle, AlertTriangle, AlertCircle, Store, Globe, ChevronLeft, Landmark, Filter, type LucideIcon } from 'lucide-react';
import { UAE_EMIRATES, getEmirateLabel } from '../../constants/uae';
import { BRANCH_TYPES, type BranchTypeValue } from '../../constants/branchTypes';

/** فلترة الأفرع: إمارة، نوع الفرع، الكيان الضريبي، أو عرض المنشآت فقط */
type BranchFilterBy = '' | 'emirate' | 'branchType' | 'taxEntity' | 'establishmentOnly';

interface BranchFilterOption {
  id: string;
  label: string;
}
import AddBranchModal from './AddBranchModal';
import WorkshopIcon from '../Icons/WorkshopIcon';
import { ViewModeToggle } from '../shared/ViewModeToggle';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePermissions } from '../../hooks/usePermissions';
import { useExpiryUiSettings } from '../../hooks/useExpiryUiSettings';

type BranchTypeIconComponent = React.ComponentType<{ size?: number; className?: string }>;
const BRANCH_TYPE_ICONS: Record<BranchTypeValue, LucideIcon | BranchTypeIconComponent> = {
  store: Store,
  workshop: WorkshopIcon,
  office: Building2,
  website: Globe,
};

interface BranchImageProps {
  photoPath?: string;
  branchName: string;
  branchType?: string;
}

function BranchListThumbnail({ photoPath, branchType }: { photoPath?: string; branchName: string; branchType?: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photoPath || !window.electronAPI?.fileGetImageUrl) return;
    (window.electronAPI as any).fileGetImageUrl(photoPath).then((r: any) => {
      if (r?.success && r?.url) setImageUrl(r.url);
    });
  }, [photoPath]);
  const typeIcon = branchType && BRANCH_TYPES.some((t) => t.value === branchType)
    ? BRANCH_TYPE_ICONS[branchType as BranchTypeValue]
    : Building2;
  const TypeIcon = typeIcon;
  if (imageUrl) {
    return <img src={imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />;
  }
  return (
    <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0">
      <TypeIcon size={24} className="text-primary-gold" />
    </div>
  );
}

function BranchImage({ photoPath, branchName, branchType }: BranchImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!photoPath);
  useEffect(() => {
    if (!photoPath) { setLoading(false); return; }
    const load = async () => {
      try {
        if (window.electronAPI?.fileGetImageUrl) {
          const r = await (window.electronAPI as any).fileGetImageUrl(photoPath);
          if (r?.success && r?.url) setImageUrl(r.url);
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    load();
  }, [photoPath]);
  const typeIcon = branchType && BRANCH_TYPES.some((t) => t.value === branchType)
    ? BRANCH_TYPE_ICONS[branchType as BranchTypeValue]
    : Building2;
  const TypeIcon = typeIcon;
  const boxClass = 'w-40 h-40 mx-auto mb-3 flex items-center justify-center rounded-lg';
  if (!photoPath || loading) {
    return <div className={boxClass}><TypeIcon size={56} className="text-primary-gold" /></div>;
  }
  if (imageUrl) {
    return (
      <div className="w-40 h-40 mx-auto mb-3 rounded-lg overflow-hidden">
        <img src={imageUrl} alt={branchName} className="w-full h-full object-cover" onError={() => setImageUrl(null)} />
      </div>
    );
  }
  return <div className={boxClass}><TypeIcon size={56} className="text-primary-gold" /></div>;
}

interface Branch {
  id: number;
  code?: string;
  name: string;
  branchType?: string;
  emirate: string;
  city?: string;
  address?: string;
  phone?: string;
  photoPath?: string;
  status?: string;
  workTimingSlots?: string;
  tradeLicenseNo?: string;
  tradeLicenseExpiry?: string;
  licenseExpiry?: string;
  leaseExpiry?: string;
  establishmentExpiry?: string;
  establishmentCardExpiry?: string;
  establishmentEnabled?: number;
  assignedPhones?: string;
}

interface CustomAlert {
  branchId: number;
  title: string;
  alertDate: string;
}

function getExpiryLabelKey(key: 'license' | 'lease' | 'establishment'): string {
  const map = { license: 'branches.expiryLicense', lease: 'branches.expiryLease', establishment: 'branches.expiryEstablishment' };
  return map[key];
}

function getDaysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

type ExpiryItem = { label: string; date: string; daysUntil: number; status: 'ok' | 'warning' | 'expired' };

/** Returns all expiry items (license, lease, establishment, custom) with dates, sorted by date. */
function getAllExpiries(
  b: Branch,
  customAlerts: CustomAlert[],
  t: (key: string, opts?: Record<string, number | string>) => string,
  warningDays: number
): ExpiryItem[] {
  const items: { label: string; date: string }[] = [];
  if (b.licenseExpiry ?? b.tradeLicenseExpiry) items.push({ label: t(getExpiryLabelKey('license')), date: (b.licenseExpiry ?? b.tradeLicenseExpiry)! });
  if (b.leaseExpiry) items.push({ label: t(getExpiryLabelKey('lease')), date: b.leaseExpiry });
  if (b.establishmentExpiry ?? b.establishmentCardExpiry) items.push({ label: t(getExpiryLabelKey('establishment')), date: (b.establishmentExpiry ?? b.establishmentCardExpiry)! });
  customAlerts.filter((a) => a.branchId === b.id).forEach((a) => a.alertDate && items.push({ label: a.title || t('branches.customSection'), date: a.alertDate }));
  return items
    .map((i) => {
      const daysUntil = getDaysUntil(i.date)!;
      const status: ExpiryItem['status'] = daysUntil <= 1 ? 'expired' : daysUntil <= warningDays ? 'warning' : 'ok';
      return { label: i.label, date: i.date, daysUntil, status };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function isTimeInRange(now: Date, from: string, to: string): boolean {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const fromMin = fh * 60 + fm;
  let toMin = th * 60 + tm;
  if (toMin <= fromMin) toMin += 24 * 60;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let nowMin24 = nowMin;
  if (nowMin < fromMin) nowMin24 += 24 * 60;
  return nowMin24 >= fromMin && nowMin24 <= toMin;
}

function computeLiveStatus(workTimingSlots: string | undefined, status: string | undefined): 'Open' | 'Closed' {
  if (status === 'suspended') return 'Closed';
  if (!workTimingSlots) return 'Closed';
  try {
    if (workTimingSlots.includes('"_24h":true') || workTimingSlots.includes('"_24h": true')) return 'Open';
  } catch {}
  const now = new Date();
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const currentDay = dayKeys[now.getDay()];
  try {
    if (workTimingSlots.startsWith('{')) {
      const schedule = JSON.parse(workTimingSlots) as Record<string, { enabled?: boolean; slots?: { from: string; to: string }[] }>;
      const day = schedule[currentDay];
      if (!day?.enabled || !day.slots?.length) return 'Closed';
      for (const slot of day.slots) {
        if (slot.from && slot.to && isTimeInRange(now, slot.from, slot.to)) return 'Open';
      }
      return 'Closed';
    }
    const slots = workTimingSlots.split(',').map((s) => s.trim());
    for (const slot of slots) {
      const [from, to] = slot.split('-').map((x) => x.trim());
      if (from && to && isTimeInRange(now, from, to)) return 'Open';
    }
  } catch {}
  return 'Closed';
}

export default function Branches() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = (i18n.language === 'en' ? 'en' : 'ar') as 'ar' | 'en';
  const isMobile = useIsMobile();
  const { can } = usePermissions();
  const { expiryWarningDays, showGreenExpiry, showYellowExpiry } = useExpiryUiSettings();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editBranchId, setEditBranchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = usePersistedViewMode('branches_viewMode', 'grid');

  const [customAlerts, setCustomAlerts] = useState<CustomAlert[]>([]);
  const [filterBy, setFilterBy] = useState<BranchFilterBy>('');
  const [filterValue, setFilterValue] = useState<string>('');
  const [entityOptions, setEntityOptions] = useState<BranchFilterOption[]>([]);

  useEffect(() => {
    if (filterBy === 'taxEntity' && window.electronAPI?.dbQuery) {
      (window.electronAPI as any)
        .dbQuery('SELECT id, name, entityNickname FROM entities WHERE (status IS NULL OR status != \'archived\') ORDER BY COALESCE(entityNickname, name)')
        .then((res: any) => {
          const list = (res?.data ?? []).map((e: any) => ({
            id: String(e.id),
            label: (e.entityNickname || e.name || t('branches.entityFallback', { id: e.id })).trim(),
          }));
          setEntityOptions(list);
        })
        .catch(() => setEntityOptions([]));
    } else {
      setEntityOptions([]);
    }
  }, [filterBy, t]);

  const loadBranches = async () => {
    try {
      if (window.electronAPI?.dbQuery) {
        let where = '';
        const params: (string | number)[] = [];
        if (filterBy === 'establishmentOnly') {
          where = ' WHERE b.id IN (SELECT branchId FROM branch_establishments WHERE isEnabled = 1)';
        } else if (filterBy === 'emirate' && filterValue) {
          where = ' AND b.emirate = ?';
          params.push(filterValue);
        } else if (filterBy === 'branchType' && filterValue) {
          where = ' AND b.branchType = ?';
          params.push(filterValue);
        } else if (filterBy === 'taxEntity' && filterValue) {
          where = ' AND b.id IN (SELECT branchId FROM tax_entity_branches WHERE entityId = ?)';
          params.push(Number(filterValue));
        }
        const baseFrom = ' FROM branches b';
        const orderClause = ' ORDER BY b.id DESC';
        const baseWhere = `(b.status IS NULL OR b.status != 'archived')`;
        const whereClause = where ? ` WHERE ${baseWhere}${where}` : ` WHERE ${baseWhere}`;
        const q = `SELECT b.id, b.code, b.name, b.branchType, b.emirate, b.city, b.address, b.phone, b.photoPath, b.status, b.workTimingSlots,
                    b.tradeLicenseNo, b.tradeLicenseExpiry, b.establishmentCardNo, b.establishmentCardExpiry,
                    (SELECT expiryDate FROM branch_licenses WHERE branchId = b.id LIMIT 1) AS licenseExpiry,
                    (SELECT expiryDate FROM branch_leases WHERE branchId = b.id LIMIT 1) AS leaseExpiry,
                    (SELECT immigrationCardExpiryDate FROM branch_establishments WHERE branchId = b.id AND isEnabled = 1 LIMIT 1) AS establishmentExpiry,
                    (SELECT isEnabled FROM branch_establishments WHERE branchId = b.id LIMIT 1) AS establishmentEnabled,
                    (SELECT COUNT(*) FROM tax_entity_branches teb WHERE teb.branchId = b.id) AS taxLinked,
                    (SELECT GROUP_CONCAT(phoneNumber, ' | ') FROM phones p WHERE p.assignedBranchId = b.id AND (p.status IS NULL OR p.status != 'archived')) AS assignedPhones
             ${baseFrom}${whereClause}${orderClause}`;
        const [branchRes, alertRes] = await Promise.all([
          params.length ? window.electronAPI.dbQuery(q, params) : window.electronAPI.dbQuery(q),
          window.electronAPI.dbQuery(
            'SELECT branchId, title, alertDate FROM branch_custom_fields WHERE enableAlert = 1 AND alertDate IS NOT NULL'
          ),
        ]);
        const rows = (branchRes?.data as Branch[]) ?? [];
        setBranches(rows);
        setCustomAlerts(((alertRes?.data as any[]) ?? []).map((r: any) => ({ branchId: r.branchId, title: r.title, alertDate: r.alertDate })));
      }
    } catch {
      setBranches([]);
      setCustomAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, [filterBy, filterValue]);

  const renderBranchCard = (b: Branch) => {
    const allExpiries = getAllExpiries(b, customAlerts, t, expiryWarningDays);
    const visibleExpiries = allExpiries.filter((item) => {
      if (item.status === 'expired') return true;
      if (item.status === 'ok') return showGreenExpiry;
      return showYellowExpiry;
    });
    const liveStatus = computeLiveStatus(b.workTimingSlots, b.status);
    const emirateAr = getEmirateLabel(b.emirate, lang);
    const cityDisplay = b.city?.trim() ? b.city.trim() : '';
    const emirateCity = cityDisplay ? `${emirateAr} - ${cityDisplay}` : emirateAr;
    const typeIcon = b.branchType && BRANCH_TYPES.some((t) => t.value === b.branchType)
      ? BRANCH_TYPE_ICONS[b.branchType as BranchTypeValue]
      : Store;
    const TypeIcon = typeIcon;
    return (
      <div
        key={b.id}
        onClick={() => navigate(`/dashboard/branches/${b.id}`)}
        className="relative bg-white p-3 border border-secondary-gray/50 rounded-md hover:border-primary-gold/50 hover:shadow-sm transition-all cursor-pointer flex flex-col"
      >
        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium z-10 ${
          liveStatus === 'Open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {liveStatus === 'Open' ? t('branches.open') : t('branches.closed')}
        </span>
        {b.establishmentEnabled && (
          <span className="absolute top-2 right-2 text-primary-gold z-10">
            <Landmark size={18} />
          </span>
        )}
        <BranchImage photoPath={b.photoPath} branchName={b.name} branchType={b.branchType} />
        <div className="flex flex-col items-center text-center flex-1">
          <div className="flex flex-col items-center justify-center w-full mt-1">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <TypeIcon size={20} className="shrink-0 text-primary-gold" />
              <h3 className="font-bold text-primary-gold text-lg">{b.name}</h3>
            </div>
            {b.code && <span className="text-xs text-dark-charcoal/50 font-mono mt-0.5" dir="ltr">{b.code}</span>}
          </div>
          <p className="text-sm text-dark-charcoal/70 mt-1">{emirateCity}</p>
          {(b.assignedPhones || b.phone) && (
            <p className="text-sm text-dark-charcoal/80 mt-1 flex items-center justify-center gap-1" dir="ltr">
              <Phone size={14} className="text-primary-gold shrink-0" />
              <span className="truncate max-w-[150px]">{b.assignedPhones || b.phone}</span>
            </p>
          )}
        </div>
        {visibleExpiries.length > 0 && (
          <div className="mt-3 pt-3 border-t border-secondary-gray/50 flex flex-col gap-1.5">
            {visibleExpiries.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-center gap-2 text-xs ${
                  item.status === 'expired'
                    ? 'text-alert-red'
                    : item.status === 'warning'
                      ? 'text-yellow-700'
                      : 'text-success-green'
                }`}
              >
                {item.status === 'ok' && <CheckCircle size={14} className="shrink-0 text-success-green" />}
                {item.status === 'warning' && <AlertTriangle size={14} className="shrink-0 text-yellow-600" />}
                {item.status === 'expired' && <AlertCircle size={14} className="shrink-0 text-alert-red" />}
                <span>
                  {item.daysUntil < 0
                    ? `${item.label}: ${t('branches.expiredDaysAgo', { count: Math.abs(item.daysUntil) })}`
                    : item.daysUntil === 0
                      ? `${item.label}: ${t('branches.expiresToday')}`
                      : `${item.label}: ${t('branches.expiresInDays', { count: item.daysUntil })}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-dark-charcoal">{t('branches.title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={18} className="text-dark-charcoal/70" />
            <span className="text-sm text-dark-charcoal/80">{t('branches.filterBy')}</span>
            <select
              value={filterBy}
              onChange={(e) => { setFilterBy(e.target.value as BranchFilterBy); setFilterValue(''); }}
              className="rounded-lg border border-secondary-gray px-3 py-2 text-sm bg-white min-w-[140px]"
            >
              <option value="">{t('branches.noFilter')}</option>
              <option value="emirate">{t('branches.emirate')}</option>
              <option value="branchType">{t('branches.branchType')}</option>
              <option value="taxEntity">{t('branches.taxEntity')}</option>
              <option value="establishmentOnly">{t('branches.establishmentOnly')}</option>
            </select>
            {filterBy && filterBy !== 'establishmentOnly' && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="rounded-lg border border-secondary-gray px-3 py-2 text-sm bg-white min-w-[160px]"
              >
                <option value="">{t('branches.choose')}</option>
                {filterBy === 'emirate' && UAE_EMIRATES.map((e) => (
                  <option key={e.value} value={e.value}>{getEmirateLabel(e.value, lang)}</option>
                ))}
                {filterBy === 'branchType' && BRANCH_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>{t(`branches.${bt.value}`)}</option>
                ))}
                {filterBy === 'taxEntity' && entityOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
          {!isMobile && <ViewModeToggle value={viewMode} onChange={setViewMode} />}
          {can('branches', 'create') && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="bg-primary-gold text-white px-6 py-2 rounded-lg hover:bg-accent-sand transition-colors min-h-[44px]"
            >
              {t('branches.addBranch')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <p className="text-secondary-gray">{t('branches.loading')}</p>
        ) : branches.length === 0 ? (
          <p className="text-secondary-gray">{t('branches.noBranches')}</p>
        ) : viewMode === 'grid' || isMobile ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {branches.map((b) => renderBranchCard(b))}
          </div>
        ) : !isMobile ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-light-background">
                <tr>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('branches.branch')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('branches.status')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('branches.location')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('branches.phone')}</th>
                  <th className="py-4 px-4 font-medium text-dark-charcoal">{t('branches.expiryAlerts')}</th>
                  <th className="py-4 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => {
                  const allExpiries = getAllExpiries(b, customAlerts, t, expiryWarningDays);
                  const visibleExpiries = allExpiries.filter((item) => {
                    if (item.status === 'expired') return true;
                    if (item.status === 'ok') return showGreenExpiry;
                    return showYellowExpiry;
                  });
                  const liveStatus = computeLiveStatus(b.workTimingSlots, b.status);
                  const emirateAr = getEmirateLabel(b.emirate, lang);
                  const cityDisplay = b.city?.trim() ? b.city.trim() : '';
                  const emirateCity = cityDisplay ? `${emirateAr} - ${cityDisplay}` : emirateAr;
                  return (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/dashboard/branches/${b.id}`)}
                      className="border-t border-secondary-gray/30 hover:bg-accent-sand/20 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <BranchListThumbnail photoPath={b.photoPath} branchName={b.name} branchType={b.branchType} />
                          <div className="flex items-center gap-2">
                            {(() => {
                              const typeIcon = b.branchType && BRANCH_TYPES.some((t) => t.value === b.branchType)
                                ? BRANCH_TYPE_ICONS[b.branchType as BranchTypeValue]
                                : Store;
                              const TypeIcon = typeIcon;
                              return <TypeIcon size={20} className="shrink-0 text-primary-gold" />;
                            })()}
                            <div className="flex flex-col">
                              <span className="font-medium text-dark-charcoal">{b.name}</span>
                              {b.code && <span className="text-xs text-dark-charcoal/50 font-mono" dir="ltr">{b.code}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            liveStatus === 'Open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {liveStatus === 'Open' ? t('branches.open') : t('branches.closed')}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-dark-charcoal">{emirateCity || '—'}</td>
                      <td className="py-4 px-4 text-dark-charcoal max-w-[120px] truncate" dir="ltr" title={b.assignedPhones || b.phone || ''}>
                        {b.assignedPhones || b.phone || '—'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          {visibleExpiries.slice(0, 4).map((item, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 text-xs ${
                                item.status === 'expired'
                                  ? 'text-alert-red'
                                  : item.status === 'warning'
                                    ? 'text-yellow-700'
                                    : 'text-success-green'
                              }`}
                            >
                              {item.status === 'ok' && <CheckCircle size={14} className="shrink-0 text-success-green" />}
                              {item.status === 'warning' && <AlertTriangle size={14} className="shrink-0 text-yellow-600" />}
                              {item.status === 'expired' && <AlertCircle size={14} className="shrink-0 text-alert-red" />}
                              <span>
                                {item.daysUntil < 0
                                  ? `${item.label}: ${t('branches.expiredDaysAgo', { count: Math.abs(item.daysUntil) })}`
                                  : item.daysUntil === 0
                                    ? `${item.label}: ${t('branches.expiresToday')}`
                                    : `${item.label}: ${t('branches.expiresInDays', { count: item.daysUntil })}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/branches/${b.id}`); }}
                          className="p-2 hover:bg-secondary-gray/30 rounded-lg"
                        >
                          <ChevronLeft size={18} className="rotate-180" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <AddBranchModal
        isOpen={addModalOpen || !!editBranchId}
        onClose={() => { setAddModalOpen(false); setEditBranchId(null); }}
        onSuccess={loadBranches}
        editBranchId={editBranchId}
      />
    </div>
  );
}
