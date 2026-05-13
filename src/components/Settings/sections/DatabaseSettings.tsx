import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, CheckCircle, AlertCircle, HardDrive, Table2, Globe, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { DatabaseConnectionConfig } from '../../../types/electron';

interface DbStats {
  tables: { name: string; count: number }[];
  sizeKB: number | null;
  path: string | null;
}

export default function DatabaseSettings() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionConfig, setConnectionConfig] = useState<DatabaseConnectionConfig | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [apiUsername, setApiUsername] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statsKey, setStatsKey] = useState(0);

  useEffect(() => {
    (async () => {
      const config = await window.electronAPI?.getDatabaseConnection?.();
      if (config) {
        setConnectionConfig(config);
        if (config.apiBaseUrl) setApiUrl(config.apiBaseUrl);
        if (config.apiUsername) setApiUsername(config.apiUsername);
        setAuthenticated(Boolean(config.authenticated));
      }
    })();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      if (!window.electronAPI?.dbQuery) {
        setError(t('settings.dbUnavailable'));
        setLoading(false);
        return;
      }

      const tables = [
        'employees', 'employers', 'branches', 'vehicles', 'phones',
        'housing_units', 'documents', 'users', 'notifications', 'activity_logs',
      ];

      const results: { name: string; count: number }[] = [];
      for (const table of tables) {
        try {
          const res = await window.electronAPI.dbQuery<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM ${table}`
          );
          results.push({ name: table, count: res?.data?.[0]?.cnt ?? 0 });
        } catch {
          results.push({ name: table, count: -1 });
        }
      }

      setStats({ tables: results, sizeKB: null, path: null });

      const cfg = await window.electronAPI?.getDatabaseConnection?.();
      if (cfg) {
        setConnectionConfig(cfg);
        setAuthenticated(Boolean(cfg.authenticated));
      }
    } catch {
      setError(t('settings.dbLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, [statsKey]);

  const TABLE_LABELS: Record<string, { ar: string; en: string }> = {
    employees: { ar: 'الموظفون', en: 'Employees' },
    employers: { ar: 'أصحاب العمل', en: 'Employers' },
    branches: { ar: 'الأفرع', en: 'Branches' },
    vehicles: { ar: 'المركبات', en: 'Vehicles' },
    phones: { ar: 'الهواتف', en: 'Phones' },
    housing_units: { ar: 'السكن', en: 'Housing' },
    documents: { ar: 'المستندات', en: 'Documents' },
    users: { ar: 'المستخدمون', en: 'Users' },
    notifications: { ar: 'الإشعارات', en: 'Notifications' },
    activity_logs: { ar: 'سجل النشاط', en: 'Activity Logs' },
  };

  if (loading) return <p className="text-secondary-gray">{t('settings.loading')}</p>;
  if (error) return <p className="text-alert-red">{error}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-dark-charcoal flex items-center gap-2">
        <Database size={22} className="text-primary-gold" />
        {t('settings.databaseTitle')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-secondary-gray rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={18} className="text-primary-gold" />
            <h3 className="font-medium text-dark-charcoal">{t('settings.dbEngine')}</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-charcoal/70">{t('settings.dbType')}</span>
              <span className="font-medium">{connectionConfig?.mode === 'remote' ? 'MySQL (Remote)' : 'SQLite3'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-charcoal/70">{t('settings.dbMode')}</span>
              <span className="font-medium flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full inline-block ${connectionConfig?.mode === 'remote' ? 'bg-primary-gold' : 'bg-success-green'}`} />
                {connectionConfig?.mode === 'remote' ? t('settings.dbModeRemote') : t('settings.dbModeLocal')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-charcoal/70">{t('settings.dbStatus')}</span>
              {connectionConfig?.mode === 'remote' ? (
                authenticated ? (
                  <span className="font-medium text-success-green flex items-center gap-1">
                    <CheckCircle size={14} />
                    متصل ومصادق
                  </span>
                ) : (
                  <span className="font-medium text-alert-red flex items-center gap-1">
                    <AlertCircle size={14} />
                    غير مصادق — أعد الاتصال
                  </span>
                )
              ) : (
                <span className="font-medium text-success-green flex items-center gap-1">
                  <CheckCircle size={14} />
                  {t('settings.dbConnected')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="border border-secondary-gray rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Table2 size={18} className="text-primary-gold" />
            <h3 className="font-medium text-dark-charcoal">{t('settings.dbSummary')}</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-charcoal/70">{t('settings.dbTotalTables')}</span>
              <span className="font-medium">{stats?.tables.length ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-charcoal/70">{t('settings.dbTotalRecords')}</span>
              <span className="font-medium">
                {stats?.tables.reduce((sum, t) => sum + (t.count > 0 ? t.count : 0), 0).toLocaleString('en') ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-secondary-gray rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={18} className="text-primary-gold" />
          <h3 className="font-medium text-dark-charcoal">{t('settings.dbRemoteTitle')}</h3>
        </div>
        <p className="text-sm text-dark-charcoal/70 mb-2">{t('settings.dbRemoteDesc')}</p>
        {connectionConfig?.mode === 'remote' && connectionConfig.apiBaseUrl && (
          <p className="text-xs text-dark-charcoal/60 mb-3 font-mono break-all" dir="ltr">
            <span className="font-sans text-dark-charcoal/70 mr-1">{t('settings.dbSavedApiUrl')}:</span>
            {connectionConfig.apiBaseUrl}
          </p>
        )}
        <p className="text-xs text-dark-charcoal/50 mb-4">{t('settings.dbConfigFileHint')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('settings.dbApiUrl')}</label>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder={t('settings.dbApiUrlPlaceholder')}
              className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('settings.dbApiUsername')}</label>
            <input
              type="text"
              value={apiUsername}
              onChange={(e) => setApiUsername(e.target.value)}
              className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('settings.dbApiPassword')}</label>
            <input
              type="password"
              value={apiPassword}
              onChange={(e) => setApiPassword(e.target.value)}
              className="w-full border border-secondary-gray rounded-lg px-3 py-2 text-sm max-w-md"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setApiUrl('http://127.0.0.1:3001');
              toast.success(t('settings.dbDevApiFilled'));
            }}
            className="px-4 py-2 rounded-lg border border-dashed border-primary-gold/60 bg-primary-gold/5 text-primary-gold text-sm font-medium hover:bg-primary-gold/10"
          >
            {t('settings.dbUseLocalDevApi')}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!apiUrl.trim() || !window.electronAPI?.testApiConnection) return;
              setTesting(true);
              try {
                const res = await window.electronAPI.testApiConnection(apiUrl.trim(), apiUsername.trim(), apiPassword);
                if (res?.success && res?.ok) {
                  toast.success(
                    (res.database ? t('settings.dbConnectionSuccess') + ' (قاعدة البيانات متاحة)' : t('settings.dbConnectionSuccess')) +
                      ' — ' +
                      t('settings.dbTestThenSaveHint')
                  );
                } else {
                  toast.error(res?.error || t('settings.dbConnectionFailed'));
                }
              } finally {
                setTesting(false);
              }
            }}
            disabled={testing || !apiUrl.trim()}
            className="px-4 py-2 rounded-lg border border-secondary-gray bg-white text-dark-charcoal text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : null}
            {t('settings.dbTestConnection')}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!apiUrl.trim() || !window.electronAPI?.setDatabaseConnection) return;
              setSaving(true);
              try {
                const res = await window.electronAPI.testApiConnection(apiUrl.trim(), apiUsername.trim(), apiPassword);
                if (!res?.success || !res?.ok) {
                  toast.error(t('settings.dbConnectionFailed'));
                  return;
                }
                if (!apiUsername.trim() || !apiPassword) {
                  toast.error('أدخل اسم المستخدم وكلمة المرور للمصادقة مع السيرفر');
                  return;
                }
                const saveRes = await window.electronAPI.setDatabaseConnection({
                  mode: 'remote',
                  apiBaseUrl: apiUrl.trim(),
                  apiUsername: apiUsername.trim(),
                  apiPassword: apiPassword,
                });
                setConnectionConfig({ mode: 'remote', apiBaseUrl: apiUrl.trim(), apiUsername: apiUsername.trim() });
                if (saveRes?.authenticated) {
                  setAuthenticated(true);
                  toast.success('تم الاتصال والمصادقة بنجاح ✓');
                  setStatsKey(k => k + 1);
                } else {
                  setAuthenticated(false);
                  toast.error('فشل المصادقة — تأكد من اسم المستخدم وكلمة المرور (مستخدم RMDATA وليس اسم قاعدة البيانات)');
                }
              } catch {
                toast.error(t('settings.dbConnectionFailed'));
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || !apiUrl.trim()}
            className="px-4 py-2 rounded-lg bg-primary-gold text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {t('settings.dbSaveAndConnect')}
          </button>
          {connectionConfig?.mode === 'remote' && (
            <button
              type="button"
              onClick={async () => {
                if (!window.electronAPI?.setDatabaseConnection) return;
                await window.electronAPI.setDatabaseConnection({ mode: 'local' });
                setConnectionConfig({ mode: 'local' });
                toast.success(t('settings.dbSaved'));
              }}
              className="px-4 py-2 rounded-lg border border-secondary-gray bg-white text-dark-charcoal text-sm font-medium"
            >
              {t('settings.dbSwitchToLocal')}
            </button>
          )}
        </div>
      </div>

      <div className="border border-secondary-gray rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary-gray/10 border-b border-secondary-gray">
              <th className="text-right px-4 py-3 font-medium text-dark-charcoal">{t('settings.dbTableName')}</th>
              <th className="text-right px-4 py-3 font-medium text-dark-charcoal">{t('settings.dbRecordCount')}</th>
              <th className="text-right px-4 py-3 font-medium text-dark-charcoal">{t('settings.dbStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {stats?.tables.map((tbl) => {
              const labels = TABLE_LABELS[tbl.name];
              return (
                <tr key={tbl.name} className="border-b border-secondary-gray/50 hover:bg-secondary-gray/5">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{labels?.ar ?? tbl.name}</span>
                    <span className="text-dark-charcoal/50 text-xs mr-2">({labels?.en ?? tbl.name})</span>
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    {tbl.count >= 0 ? tbl.count.toLocaleString('en') : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {tbl.count >= 0 ? (
                      <span className="text-success-green flex items-center gap-1">
                        <CheckCircle size={14} /> {t('settings.dbOk')}
                      </span>
                    ) : (
                      <span className="text-alert-red flex items-center gap-1">
                        <AlertCircle size={14} /> {t('settings.dbError')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
