import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';
import {
  FileText, Search, Archive, RotateCcw, UserCheck, UserPlus, Plus, Edit3,
  Calendar, ChevronLeft, ChevronRight, ChevronDown, Download, Filter, X,
  Users, Building2, Car, Home, Smartphone, Briefcase, User,
} from 'lucide-react';
import TaxIcon from '../components/Icons/TaxIcon';
import { getEntityLabelsByIds, getRecentActivityLogs } from '../services/logsService';
import { translateLogDetails, hasExpandableChanges, extractChangeLines } from '../utils/translateLogDetails';

const MODULE_KEYS = ['employee', 'branch', 'vehicle', 'housing', 'phone', 'entity', 'employer', 'archive', 'tax'] as const;
const ACTION_KEYS = ['create', 'edit', 'status_change', 'expiry_update', 'archive', 'restore', 'assign_responsible', 'assign_occupant', 'remove_occupant', 'date_correction'] as const;

const MODULE_LABELS_AR: Record<string, string> = {
  employee: 'الموظفون', branch: 'الأفرع', vehicle: 'المركبات', housing: 'السكن',
  phone: 'الهواتف', tax: 'الضرائب', entity: 'الكيانات', employer: 'أصحاب العمل', archive: 'الأرشيف',
};
const MODULE_LABELS_EN: Record<string, string> = {
  employee: 'Employees', branch: 'Branches', vehicle: 'Vehicles', housing: 'Housing',
  phone: 'Phones', tax: 'Taxes', entity: 'Entities', employer: 'Employers', archive: 'Archive',
};

const ACTION_LABELS_AR: Record<string, string> = {
  status_change: 'تحديث حالة', expiry_update: 'تحديث وثيقة', create: 'إضافة', edit: 'تعديل',
  archive: 'أرشفة', restore: 'استعادة', assign_responsible: 'تعيين مسؤول', assign_occupant: 'تعيين ساكن',
  remove_occupant: 'إزالة ساكن', date_correction: 'تصحيح تاريخ',
};
const ACTION_LABELS_EN: Record<string, string> = {
  status_change: 'Status change', expiry_update: 'Expiry update', create: 'Create', edit: 'Edit',
  archive: 'Archive', restore: 'Restore', assign_responsible: 'Assign responsible', assign_occupant: 'Assign occupant',
  remove_occupant: 'Remove occupant', date_correction: 'Date correction',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODULE_ICONS: Record<string, React.ComponentType<any>> = {
  employee: Users, branch: Building2, vehicle: Car, housing: Home,
  phone: Smartphone, entity: Briefcase, employer: User, archive: Archive, tax: TaxIcon,
};

const ACTION_ICON_MAP: Record<string, React.ReactNode> = {
  create: <Plus size={14} />, edit: <Edit3 size={14} />, status_change: <UserCheck size={14} />,
  expiry_update: <Calendar size={14} />, archive: <Archive size={14} />, restore: <RotateCcw size={14} />,
  assign_responsible: <UserPlus size={14} />, assign_occupant: <UserPlus size={14} />,
  remove_occupant: <X size={14} />, date_correction: <Calendar size={14} />,
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700', edit: 'bg-blue-100 text-blue-700',
  status_change: 'bg-indigo-100 text-indigo-700', expiry_update: 'bg-amber-100 text-amber-700',
  archive: 'bg-orange-100 text-orange-700', restore: 'bg-green-100 text-green-700',
  assign_responsible: 'bg-cyan-100 text-cyan-700', assign_occupant: 'bg-teal-100 text-teal-700',
  remove_occupant: 'bg-rose-100 text-rose-700', date_correction: 'bg-purple-100 text-purple-700',
};

const ENTITY_ROUTES: Record<string, string> = {
  employee: '/dashboard/employees/', branch: '/dashboard/branches/', vehicle: '/dashboard/vehicles/',
  housing: '/dashboard/housing/', entity: '/dashboard/entities/', employer: '/dashboard/employers/',
  phone: '/dashboard/phones/',
};

const PAGE_SIZE = 50;

interface LogRow {
  id: number; createdAt: string; module: string; action: string; entityType: string;
  entityId?: number; details?: string; performedByUsername?: string;
  performedByUserCode?: string; performedByUserId?: number; entityName?: string;
}

export default function Logs() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const isAr = i18n.language === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const MODULE_LABELS = isAr ? MODULE_LABELS_AR : MODULE_LABELS_EN;
  const ACTION_LABELS = isAr ? ACTION_LABELS_AR : ACTION_LABELS_EN;

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.dbQuery) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await getRecentActivityLogs(2000);
        const rows = (res?.data ?? []) as LogRow[];
        const entityNames = new Map<string, string>();
        const groupedIds: Record<string, number[]> = {};
        for (const r of rows) {
          if (!r.entityId) continue;
          const key = r.entityType;
          if (!groupedIds[key]) groupedIds[key] = [];
          if (!groupedIds[key].includes(r.entityId)) groupedIds[key].push(r.entityId);
        }
        await Promise.all(
          Object.entries(groupedIds).map(async ([et, ids]) => {
            if (ids.length === 0) return;
            const result = await getEntityLabelsByIds(et, ids);
            for (const row of (result?.data ?? []) as Array<{ id: number; label?: string }>) {
              entityNames.set(`${et}:${row.id}`, row.label || '—');
            }
          })
        ).catch(() => {});
        setLogs(rows.map((r) => ({ ...r, entityName: r.entityId ? entityNames.get(`${r.entityType}:${r.entityId}`) ?? '—' : undefined })));
      } catch { setLogs([]); } finally { setLoading(false); }
    })();
  }, []);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (filterModule) result = result.filter((r) => r.module === filterModule);
    if (filterAction) result = result.filter((r) => r.action === filterAction);
    if (filterDateFrom) result = result.filter((r) => (r.createdAt || '').slice(0, 10) >= filterDateFrom);
    if (filterDateTo) result = result.filter((r) => (r.createdAt || '').slice(0, 10) <= filterDateTo);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) =>
        (r.module || '').toLowerCase().includes(q) || (r.action || '').toLowerCase().includes(q) ||
        (r.details || '').toLowerCase().includes(q) || (r.performedByUsername || '').toLowerCase().includes(q) ||
        (r.entityName || '').toLowerCase().includes(q) || (MODULE_LABELS[r.module] || '').toLowerCase().includes(q) ||
        (ACTION_LABELS[r.action] || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, search, filterModule, filterAction, filterDateFrom, filterDateTo, MODULE_LABELS, ACTION_LABELS]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, filterModule, filterAction, filterDateFrom, filterDateTo]);

  const hasActiveFilters = !!(filterModule || filterAction || filterDateFrom || filterDateTo);

  const handleExportCSV = () => {
    const header = ['Time', 'Module', 'Entity', 'Action', 'Details', 'User'];
    const csvRows = [header.join(',')];
    for (const r of filteredLogs) {
      const time = r.createdAt ? String(r.createdAt).slice(0, 19).replace('T', ' ') : '';
      const mod = MODULE_LABELS[r.module] || r.module;
      const ent = (r.entityName || '').replace(/,/g, ' ');
      const act = ACTION_LABELS[r.action] || r.action;
      const det = translateLogDetails(r.details, t, isAr ? 'ar' : 'en').replace(/,/g, ' ').replace(/\n/g, ' ');
      const usr = r.performedByUsername ? `${r.performedByUsername}${r.performedByUserCode ? ` (${r.performedByUserCode})` : ''}` : '';
      csvRows.push([time, mod, ent, act, det, usr].map((v) => `"${v}"`).join(','));
    }
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `system-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const clearFilters = () => { setFilterModule(''); setFilterAction(''); setFilterDateFrom(''); setFilterDateTo(''); setSearch(''); };

  const getEntityRoute = (r: LogRow) => {
    if (!r.entityId) return null;
    const base = ENTITY_ROUTES[r.entityType];
    return base ? `${base}${r.entityId}` : null;
  };

  const selectClass = `px-3 py-2 rounded-lg border border-secondary-gray bg-white text-sm focus:ring-2 focus:ring-primary-gold ${dir === 'rtl' ? 'text-right' : 'text-left'}`;

  if (!can('logs', 'view')) return <p className="p-8 text-center text-secondary-gray">{t('common.noPermission', 'ليس لديك صلاحية الوصول')}</p>;

  return (
    <div className="space-y-4" dir={dir}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileText size={28} className="text-primary-gold" />
          <h1 className="text-2xl font-bold text-dark-charcoal">{isAr ? 'سجل النظام' : 'System Log'}</h1>
          <span className="text-sm text-secondary-gray">({filteredLogs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${hasActiveFilters ? 'border-primary-gold bg-primary-gold/10 text-primary-gold' : 'border-secondary-gray hover:bg-secondary-gray/20 text-dark-charcoal/70'}`}>
            <Filter size={16} /> {isAr ? 'فلترة' : 'Filters'} {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary-gold" />}
          </button>
          <button type="button" onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-gray hover:bg-secondary-gray/20 text-dark-charcoal/70 text-sm font-medium">
            <Download size={16} /> CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-secondary-gray p-4 flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-secondary-gray ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'بحث نصي...' : 'Search...'}
              className={`w-full py-2 rounded-lg border border-secondary-gray bg-white text-sm focus:ring-2 focus:ring-primary-gold ${dir === 'rtl' ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'}`} dir={dir} />
          </div>
          <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className={selectClass}>
            <option value="">{isAr ? 'كل الأقسام' : 'All modules'}</option>
            {MODULE_KEYS.map((k) => <option key={k} value={k}>{MODULE_LABELS[k] || k}</option>)}
          </select>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className={selectClass}>
            <option value="">{isAr ? 'كل الإجراءات' : 'All actions'}</option>
            {ACTION_KEYS.map((k) => <option key={k} value={k}>{ACTION_LABELS[k] || k}</option>)}
          </select>
          <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
            className={selectClass} title={isAr ? 'من تاريخ' : 'From date'} />
          <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
            className={selectClass} title={isAr ? 'إلى تاريخ' : 'To date'} />
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-sm text-alert-red hover:underline">{isAr ? 'مسح الفلاتر' : 'Clear'}</button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="border border-secondary-gray rounded-lg p-12 text-center text-secondary-gray">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : filteredLogs.length === 0 ? (
        <div className="border border-secondary-gray rounded-lg p-12 text-center text-secondary-gray">
          {logs.length === 0 ? (isAr ? 'لا يوجد سجل نشاط.' : 'No activity logs.') : (isAr ? 'لا توجد نتائج مطابقة.' : 'No matching results.')}
        </div>
      ) : (
        <div className="border border-secondary-gray rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead className="bg-primary-gold/10">
                <tr>
                  <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'الوقت' : 'Time'}</th>
                  <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'القسم' : 'Module'}</th>
                  <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'العنصر' : 'Entity'}</th>
                  <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'الإجراء' : 'Action'}</th>
                  <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'التفاصيل' : 'Details'}</th>
                  <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'المستخدم' : 'User'}</th>
                </tr>
              </thead>
              <tbody>
                {pagedLogs.map((row) => {
                  const ModIcon = MODULE_ICONS[row.module];
                  const actionColor = ACTION_COLORS[row.action] || 'bg-secondary-gray/20 text-dark-charcoal';
                  const route = getEntityRoute(row);
                  return (
                    <tr key={row.id} className="border-t border-secondary-gray/30 hover:bg-secondary-gray/5 transition-colors">
                      <td className="p-3 text-dark-charcoal/70 text-xs whitespace-nowrap">
                        {row.createdAt ? String(row.createdAt).slice(0, 19).replace('T', ' ') : '—'}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-dark-charcoal">
                          {ModIcon && <ModIcon size={15} className="text-primary-gold/80 shrink-0" />}
                          {MODULE_LABELS[row.module] || row.module}
                        </span>
                      </td>
                      <td className="p-3 text-sm">
                        {route ? (
                          <button type="button" onClick={() => navigate(route)}
                            className="text-primary-gold hover:underline font-medium truncate max-w-[180px] block text-start">
                            {row.entityName || '—'}
                          </button>
                        ) : (
                          <span className="text-dark-charcoal/70 truncate max-w-[180px] block">{row.entityName || '—'}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${actionColor}`}>
                          {ACTION_ICON_MAP[row.action]}
                          {ACTION_LABELS[row.action] || row.action}
                        </span>
                      </td>
                      <td className="p-3 text-dark-charcoal/70 text-sm max-w-xs">
                        {hasExpandableChanges(row.details) ? (
                          <button type="button" onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                            className="flex items-center gap-1 text-start hover:text-primary-gold transition-colors">
                            <ChevronDown size={14} className={`shrink-0 transition-transform ${expandedRowId === row.id ? 'rotate-180' : ''}`} />
                            <span className="truncate">{translateLogDetails(row.details, t, isAr ? 'ar' : 'en')}</span>
                          </button>
                        ) : (
                          <span className="truncate block" title={translateLogDetails(row.details, t, isAr ? 'ar' : 'en')}>
                            {translateLogDetails(row.details, t, isAr ? 'ar' : 'en')}
                          </span>
                        )}
                        {expandedRowId === row.id && (() => {
                          const parsed = extractChangeLines(row.details, t, isAr ? 'ar' : 'en');
                          if (!parsed) return null;
                          return (
                            <ul className="mt-2 space-y-1 text-xs border-t border-secondary-gray/30 pt-2">
                              {parsed.lines.map((line, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary-gold/60 mt-1.5 shrink-0" />
                                  <span className="text-dark-charcoal/80">{line}</span>
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                      </td>
                      <td className="p-3 text-dark-charcoal/70 text-sm whitespace-nowrap">
                        {row.performedByUsername
                          ? `${row.performedByUsername}${row.performedByUserCode ? ` (${row.performedByUserCode})` : ''}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-gray/30 bg-secondary-gray/5">
              <span className="text-sm text-dark-charcoal/60">
                {isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg hover:bg-secondary-gray/20 disabled:opacity-30"><ChevronRight size={18} /></button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pg: number;
                  if (totalPages <= 7) pg = i + 1;
                  else if (page <= 4) pg = i + 1;
                  else if (page >= totalPages - 3) pg = totalPages - 6 + i;
                  else pg = page - 3 + i;
                  return (
                    <button key={pg} type="button" onClick={() => setPage(pg)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium ${page === pg ? 'bg-primary-gold text-white' : 'hover:bg-secondary-gray/20 text-dark-charcoal/70'}`}>
                      {pg}
                    </button>
                  );
                })}
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg hover:bg-secondary-gray/20 disabled:opacity-30"><ChevronLeft size={18} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
