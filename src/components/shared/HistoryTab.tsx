import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  History, FileText, Briefcase, List, Clock,
  UserCheck, Calendar, Archive, RotateCcw, Plus, Edit3, UserPlus, X,
} from 'lucide-react';
import { getEmployeeStatusHistory } from '../../services/employeeService';
import { getEntityActivityLogs } from '../../services/logsService';
import { translateLogDetails, hasExpandableChanges, extractChangeLines } from '../../utils/translateLogDetails';

interface HistoryTabProps {
  entityType: 'employee' | 'branch' | 'vehicle' | 'housing' | 'phone' | 'employer' | 'entity';
  entityId: number;
  entityName?: string;
}

export interface HistoryRow {
  id: number;
  type: 'status' | 'activity';
  date: string;
  action: string;
  actionKey: string;
  details: string;
  user?: string;
  durationDays?: number;
  durationDisplay?: string;
  statusKey?: string;
}

const todayDate = () => new Date().toISOString().slice(0, 10);
const daysBetween = (start: string, end: string) => {
  const a = new Date(start.slice(0, 10));
  const b = new Date(end.slice(0, 10));
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  status_change: <UserCheck size={14} />, date_correction: <Calendar size={14} />,
  expiry_update: <Calendar size={14} />, assign_responsible: <UserPlus size={14} />,
  assign_occupant: <UserPlus size={14} />, remove_occupant: <X size={14} />,
  create: <Plus size={14} />, edit: <Edit3 size={14} />,
  archive: <Archive size={14} />, restore: <RotateCcw size={14} />,
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500', leave: 'bg-amber-500', suspended: 'bg-orange-500',
  inactive: 'bg-gray-400', seconded: 'bg-blue-500', visa_cancelled: 'bg-red-500',
  terminated: 'bg-red-600',
};

const ACTION_COLORS: Record<string, string> = {
  status_change: 'bg-indigo-500', date_correction: 'bg-purple-500', expiry_update: 'bg-amber-500',
  assign_responsible: 'bg-cyan-500', assign_occupant: 'bg-teal-500', remove_occupant: 'bg-rose-500',
  create: 'bg-emerald-500', edit: 'bg-blue-500', archive: 'bg-orange-500', restore: 'bg-green-500',
};

export default function HistoryTab({ entityType, entityId, entityName: _entityName }: HistoryTabProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const STATUS_LABELS: Record<string, string> = {
    active: isAr ? 'يعمل' : 'Active', leave: isAr ? 'إجازة' : 'Leave',
    suspended: isAr ? 'موقوف' : 'Suspended', inactive: isAr ? 'لا يعمل' : 'Inactive',
    seconded: isAr ? 'معار' : 'Seconded', visa_cancelled: isAr ? 'إلغاء تأشيرة' : 'Visa cancelled',
    terminated: isAr ? 'إنهاء التعاقد' : 'Terminated',
  };

  const ACTION_LABELS: Record<string, string> = {
    status_change: isAr ? 'تحديث حالة' : 'Status change',
    date_correction: isAr ? 'تصحيح تاريخ' : 'Date correction',
    expiry_update: isAr ? 'تحديث وثيقة' : 'Expiry update',
    assign_responsible: isAr ? 'تعيين مسؤول' : 'Assign responsible',
    assign_occupant: isAr ? 'تعيين ساكن' : 'Assign occupant',
    remove_occupant: isAr ? 'إزالة ساكن' : 'Remove occupant',
    create: isAr ? 'إضافة' : 'Create', edit: isAr ? 'تعديل' : 'Edit',
    archive: isAr ? 'أرشفة' : 'Archive', restore: isAr ? 'استعادة' : 'Restore',
  };

  const [allRows, setAllRows] = useState<HistoryRow[]>([]);
  const [workRows, setWorkRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'general' | 'work'>('general');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('timeline');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!entityId || !window.electronAPI?.dbQuery) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const generalRows: HistoryRow[] = [];
        const workOnlyRows: HistoryRow[] = [];

        const formatPerformer = (name?: string, code?: string, userId?: number) => {
          if (!name) return undefined;
          if (code) return `${name} (${code})`;
          if (userId != null) return `${name} (${userId})`;
          return name;
        };

        if (entityType === 'employee') {
          const statusRes = await getEmployeeStatusHistory(entityId);
          const today = todayDate();
          for (const r of (statusRes?.data ?? []) as Array<{ id: number; status: string; startDate: string; endDate?: string; durationDays?: number; performedByUsername?: string; performedByUserCode?: string; performedByUserId?: number }>) {
            const label = STATUS_LABELS[r.status] || r.status;
            const startStr = r.startDate ? String(r.startDate).slice(0, 10) : '';
            const end = r.endDate ? String(r.endDate).slice(0, 10) : '—';
            const dur = r.durationDays != null ? ` (${r.durationDays} ${isAr ? 'يوم' : 'days'})` : '';
            const row: HistoryRow = {
              id: r.id, type: 'status', date: startStr,
              action: ACTION_LABELS.status_change, actionKey: 'status_change',
              details: `${label} ${isAr ? 'من' : 'from'} ${startStr} ${isAr ? 'إلى' : 'to'} ${end}${dur}`,
              user: formatPerformer(r.performedByUsername, r.performedByUserCode, r.performedByUserId),
              durationDays: r.durationDays ?? undefined, statusKey: r.status,
            };
            generalRows.push(row);

            const buildWorkRow = (statusText: string) => {
              const detail = `${statusText} ${isAr ? 'بتاريخ' : 'on'} ${startStr}`;
              const durDisplay = !r.endDate
                ? `${statusText} ${isAr ? 'منذ' : 'for'} ${daysBetween(startStr, today)} ${isAr ? 'يوم' : 'days'}`
                : (r.durationDays != null ? `${r.durationDays} ${isAr ? 'يوم' : 'days'}` : '—');
              return { ...row, details: detail, durationDisplay: durDisplay };
            };
            if (r.status === 'leave') workOnlyRows.push(buildWorkRow(STATUS_LABELS.leave));
            else if (r.status === 'suspended') workOnlyRows.push(buildWorkRow(STATUS_LABELS.suspended));
            else if (r.status === 'inactive') workOnlyRows.push(buildWorkRow(STATUS_LABELS.inactive));
            else if (r.status === 'active') workOnlyRows.push(buildWorkRow(isAr ? 'عاد للعمل' : 'Returned to work'));
            else workOnlyRows.push({ ...row });
          }
        }

        const logRes = await getEntityActivityLogs(entityType, entityId);
        for (const r of (logRes?.data ?? []) as Array<{ id: number; createdAt: string; module: string; action: string; details?: string; performedByUsername?: string; performedByUserCode?: string; performedByUserId?: number }>) {
          const actionLabel = ACTION_LABELS[r.action] || r.action;
          const row: HistoryRow = {
            id: r.id + 100000, type: 'activity',
            date: r.createdAt ? String(r.createdAt).slice(0, 19).replace('T', ' ') : '',
            action: actionLabel, actionKey: r.action,
            details: r.details || '', user: formatPerformer(r.performedByUsername, r.performedByUserCode, r.performedByUserId),
          };
          generalRows.push(row);
          if (entityType === 'employee' && r.action === 'status_change') workOnlyRows.push(row);
        }

        const sortByDate = (a: HistoryRow, b: HistoryRow) => (b.date || '').localeCompare(a.date || '');
        generalRows.sort(sortByDate);
        workOnlyRows.sort(sortByDate);
        setAllRows(generalRows);
        setWorkRows(workOnlyRows);
      } catch { setAllRows([]); setWorkRows([]); } finally { setLoading(false); }
    })();
  }, [entityType, entityId, isAr]);

  const isEmployee = entityType === 'employee';
  const rows = isEmployee && subTab === 'work' ? workRows : allRows;
  const showDuration = entityType === 'employee';

  const getTimelineDotColor = (row: HistoryRow) => {
    if (row.type === 'status' && row.statusKey) return STATUS_COLORS[row.statusKey] || 'bg-gray-400';
    return ACTION_COLORS[row.actionKey] || 'bg-gray-400';
  };

  if (loading) {
    return <div className="border border-secondary-gray rounded-lg p-8 text-center text-secondary-gray">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  const renderSubTabs = () => (
    isEmployee && (
      <div className="flex gap-1 p-2 border-b border-secondary-gray/30">
        <button type="button" onClick={() => setSubTab('general')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${subTab === 'general' ? 'bg-primary-gold text-white' : 'text-dark-charcoal/70 hover:bg-secondary-gray/20'}`}>
          <FileText size={18} /> {isAr ? 'السجل العام' : 'General log'}
        </button>
        <button type="button" onClick={() => setSubTab('work')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${subTab === 'work' ? 'bg-primary-gold text-white' : 'text-dark-charcoal/70 hover:bg-secondary-gray/20'}`}>
          <Briefcase size={18} /> {isAr ? 'سجل عمل الموظف' : 'Work log'}
        </button>
      </div>
    )
  );

  const renderViewToggle = () => (
    <div className="flex gap-1">
      <button type="button" onClick={() => setViewMode('timeline')} title={isAr ? 'خط زمني' : 'Timeline'}
        className={`p-1.5 rounded-lg ${viewMode === 'timeline' ? 'bg-primary-gold text-white' : 'text-dark-charcoal/50 hover:bg-secondary-gray/20'}`}><Clock size={16} /></button>
      <button type="button" onClick={() => setViewMode('table')} title={isAr ? 'جدول' : 'Table'}
        className={`p-1.5 rounded-lg ${viewMode === 'table' ? 'bg-primary-gold text-white' : 'text-dark-charcoal/50 hover:bg-secondary-gray/20'}`}><List size={16} /></button>
    </div>
  );

  const renderSummary = () => {
    if (!isEmployee || rows.length === 0) return null;
    const latestStatus = allRows.find((r) => r.type === 'status');
    return (
      <div className="flex flex-wrap gap-3 p-3 bg-secondary-gray/10 border-b border-secondary-gray/30">
        {latestStatus?.statusKey && (
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[latestStatus.statusKey] || 'bg-gray-400'}`} />
            <span className="text-sm font-medium text-dark-charcoal">{STATUS_LABELS[latestStatus.statusKey] || latestStatus.statusKey}</span>
            {latestStatus.durationDisplay && <span className="text-xs text-dark-charcoal/50">({latestStatus.durationDisplay})</span>}
          </div>
        )}
        <span className="text-xs text-dark-charcoal/50">{isAr ? `${allRows.length} سجل` : `${allRows.length} records`}</span>
      </div>
    );
  };

  const renderTimeline = () => (
    <div className="p-4 space-y-0">
      {rows.map((row, i) => {
        const dotColor = getTimelineDotColor(row);
        const isLast = i === rows.length - 1;
        return (
          <div key={`${row.type}-${row.id}`} className="flex gap-4">
            {/* Line + dot */}
            <div className="flex flex-col items-center w-6 shrink-0">
              <div className={`w-3 h-3 rounded-full ${dotColor} ring-2 ring-white shadow-sm mt-1.5 shrink-0 z-10`} />
              {!isLast && <div className="w-px flex-1 bg-secondary-gray/40 min-h-[24px]" />}
            </div>
            {/* Card */}
            <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
              <div className="bg-white rounded-lg border border-secondary-gray/40 p-3 hover:border-primary-gold/30 transition-colors">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    row.type === 'status' ? 'bg-indigo-100 text-indigo-700' : (ACTION_COLORS[row.actionKey] ? ACTION_COLORS[row.actionKey].replace('bg-', 'bg-').replace('500', '100') : 'bg-gray-100 text-gray-700')
                  }`} style={row.type === 'activity' ? {} : undefined}>
                    {ACTION_ICONS[row.actionKey] || <History size={14} />}
                    {row.action}
                  </span>
                  <span className="text-xs text-dark-charcoal/50">{row.date}</span>
                  {row.durationDisplay && <span className="text-xs text-dark-charcoal/50 font-medium">· {row.durationDisplay}</span>}
                </div>
                <p className="text-sm text-dark-charcoal/80">
                  {hasExpandableChanges(row.details) ? (
                    <button type="button" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      className="text-start hover:text-primary-gold transition-colors">
                      {translateLogDetails(row.details, t, isAr ? 'ar' : 'en')}
                    </button>
                  ) : translateLogDetails(row.details, t, isAr ? 'ar' : 'en')}
                </p>
                {expandedId === row.id && (() => {
                  const parsed = extractChangeLines(row.details, t, isAr ? 'ar' : 'en');
                  if (!parsed) return null;
                  return (
                    <ul className="mt-1.5 space-y-0.5 text-xs border-t border-secondary-gray/20 pt-1.5">
                      {parsed.lines.map((line, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-gold/60 mt-1.5 shrink-0" />
                          <span className="text-dark-charcoal/70">{line}</span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
                {row.user && <p className="text-xs text-secondary-gray mt-1">{isAr ? 'بواسطة' : 'By'}: {row.user}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-start" dir={dir}>
        <thead className="bg-secondary-gray/20">
          <tr>
            <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'التاريخ' : 'Date'}</th>
            <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'الإجراء' : 'Action'}</th>
            <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'التفاصيل' : 'Details'}</th>
            {showDuration && <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'المدة' : 'Duration'}</th>}
            <th className="p-3 text-dark-charcoal font-medium text-sm">{isAr ? 'المستخدم' : 'User'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.type}-${row.id}`} className="border-t border-secondary-gray/30 hover:bg-secondary-gray/5">
              <td className="p-3 text-dark-charcoal/70 text-sm whitespace-nowrap">{row.date}</td>
              <td className="p-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  row.type === 'status' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {ACTION_ICONS[row.actionKey] || <History size={14} />}
                  {row.action}
                </span>
              </td>
              <td className="p-3 text-dark-charcoal/80 text-sm">
                {hasExpandableChanges(row.details) ? (
                  <button type="button" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    className="text-start hover:text-primary-gold transition-colors">
                    {translateLogDetails(row.details, t, isAr ? 'ar' : 'en')}
                  </button>
                ) : translateLogDetails(row.details, t, isAr ? 'ar' : 'en')}
                {expandedId === row.id && (() => {
                  const parsed = extractChangeLines(row.details, t, isAr ? 'ar' : 'en');
                  if (!parsed) return null;
                  return (
                    <ul className="mt-1.5 space-y-0.5 text-xs border-t border-secondary-gray/20 pt-1.5">
                      {parsed.lines.map((line, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-gold/60 mt-1.5 shrink-0" />
                          <span className="text-dark-charcoal/70">{line}</span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </td>
              {showDuration && (
                <td className="p-3 text-dark-charcoal/70 text-sm">{row.durationDisplay ?? (row.durationDays != null ? row.durationDays : '—')}</td>
              )}
              <td className="p-3 text-dark-charcoal/70 text-sm">{row.user || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="border border-secondary-gray rounded-lg overflow-hidden bg-white" dir={dir}>
      <div className="p-4 bg-primary-gold/10 border-b border-secondary-gray flex items-center justify-between">
        <h4 className="text-primary-gold font-bold flex items-center gap-2"><History size={18} /> {isAr ? 'السجل' : 'History'}</h4>
        {renderViewToggle()}
      </div>
      {renderSubTabs()}
      {renderSummary()}
      {rows.length === 0 ? (
        <div className="p-8 text-center text-secondary-gray">
          <History size={40} className="mx-auto mb-3 opacity-50" />
          <p>{isAr ? 'لا يوجد سجل بعد.' : 'No history yet.'}</p>
        </div>
      ) : viewMode === 'timeline' ? renderTimeline() : renderTable()}
    </div>
  );
}
