import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, CheckCircle, AlertTriangle, Copy, RefreshCw, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AboutSettings() {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState<string>('');
  const [connMode, setConnMode] = useState<'local' | 'remote'>('local');
  const [checking, setChecking] = useState(false);
  const [autoUpdateCheckEnabled, setAutoUpdateCheckEnabled] = useState(true);
  const [updateState, setUpdateState] = useState<{
    stage: 'checking' | 'available' | 'none' | 'downloading' | 'downloaded' | 'error';
    version?: string;
    notes?: string;
    percent?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const v = await window.electronAPI?.getAppVersion?.();
        if (v) setAppVersion(v);
      } catch {
        // ignore - fallback to empty
      }
      try {
        const c = await window.electronAPI?.getDatabaseConnection?.();
        if (c?.mode) setConnMode(c.mode);
      } catch { /* ignore */ }
      try {
        const au = await window.electronAPI?.getAutoUpdateCheckEnabled?.();
        if (au?.success) setAutoUpdateCheckEnabled(au.enabled !== false);
      } catch { /* ignore */ }
    })();

    const unsubscribe = window.electronAPI?.onUpdateStatus?.((status) => {
      if (status.stage === 'checking') setUpdateState({ stage: 'checking' });
      if (status.stage === 'available') setUpdateState({ stage: 'available', version: status.version, notes: status.notes });
      if (status.stage === 'none') setUpdateState({ stage: 'none' });
      if (status.stage === 'downloading') setUpdateState({ stage: 'downloading', percent: status.percent });
      if (status.stage === 'downloaded') setUpdateState({ stage: 'downloaded', version: status.version });
      if (status.stage === 'error') setUpdateState({ stage: 'error', error: status.message });
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleCheckUpdates = async () => {
    setChecking(true);
    setUpdateState({ stage: 'checking' });
    try {
      const result = await window.electronAPI?.checkForUpdates?.();
      if (!result?.success) {
        setUpdateState({ stage: 'error', error: result?.error || 'Update check failed' });
        toast.error(result?.error || 'Update check failed');
        return;
      }
      if (!result?.hasUpdate) {
        setUpdateState({ stage: 'none' });
        toast.success(t('settings.aboutNoUpdate'));
      }
    } catch {
      setUpdateState({ stage: 'error', error: 'Update check failed' });
      toast.error('Update check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleToggleAutoUpdateCheck = async () => {
    const next = !autoUpdateCheckEnabled;
    setAutoUpdateCheckEnabled(next);
    try {
      const res = await window.electronAPI?.setAutoUpdateCheckEnabled?.(next);
      if (!res?.success) {
        setAutoUpdateCheckEnabled(!next);
        toast.error(res?.error || t('settings.aboutAutoUpdateCheckSaveFailed'));
      } else {
        toast.success(next ? t('settings.aboutAutoUpdateCheckEnabled') : t('settings.aboutAutoUpdateCheckDisabled'));
      }
    } catch {
      setAutoUpdateCheckEnabled(!next);
      toast.error(t('settings.aboutAutoUpdateCheckSaveFailed'));
    }
  };

  const handleDownloadUpdate = async () => {
    const res = await window.electronAPI?.downloadUpdate?.();
    if (!res?.success) {
      toast.error(res?.error || 'فشل بدء تنزيل التحديث');
    }
  };

  const handleInstallUpdate = async () => {
    const res = await window.electronAPI?.quitAndInstallUpdate?.();
    if (!res?.success) {
      toast.error(res?.error || 'Update is not ready yet');
    }
  };

  const buildDate = __APP_BUILD_DATE__;
  const dbEngineLabel =
    connMode === 'remote' ? t('settings.aboutDbEngineMysql') : t('settings.aboutDbEngineSqlite');
  const modeLabel = connMode === 'remote' ? t('settings.aboutModeRemote') : t('settings.aboutModeLocal');

  const handleCopySystemInfo = () => {
    const info = [
      `RM DATA System v${appVersion || 'unknown'}`,
      `Build: ${buildDate}`,
      `DB: ${dbEngineLabel}`,
      `Mode: ${modeLabel}`,
      `Platform: ${navigator.platform}`,
      `User Agent: ${navigator.userAgent}`,
      `Language: ${navigator.language}`,
      `Screen: ${screen.width}x${screen.height}`,
      `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    ].join('\n');
    navigator.clipboard.writeText(info);
    toast.success(t('settings.aboutCopied'));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-dark-charcoal flex items-center gap-2">
        <Info size={22} className="text-primary-gold" />
        {t('settings.aboutTitle')}
      </h2>

      <div className="text-center py-6 rounded-xl bg-gradient-to-b from-primary-gold/[0.06] to-transparent px-4">
        <div className="inline-flex rounded-2xl bg-white/80 shadow-sm ring-1 ring-primary-gold/15 p-4 mb-4">
          <img src="./assets/rmdata_logo.png" alt="RM DATA" className="w-24 h-24 object-contain" />
        </div>
        <h3 className="text-lg font-bold text-dark-charcoal">
          {t('settings.aboutSystemName')}
        </h3>
        <p className="text-sm text-dark-charcoal/60 mt-1">
          RM DATA Management System
        </p>
      </div>

      <div className="border border-secondary-gray rounded-xl divide-y divide-secondary-gray/50 shadow-sm bg-white/50 backdrop-blur-[1px]">
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-dark-charcoal/70">{t('settings.aboutVersion')}</span>
            <span className="font-medium text-dark-charcoal">v{appVersion || '...'}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-dark-charcoal/70">{t('settings.aboutBuildDate')}</span>
          <span className="font-medium text-dark-charcoal">{buildDate}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-dark-charcoal/70">{t('settings.aboutDbEngine')}</span>
          <span className="font-medium text-dark-charcoal">{dbEngineLabel}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-dark-charcoal/70">{t('settings.aboutMode')}</span>
          <span className="font-medium text-dark-charcoal flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full inline-block ${connMode === 'remote' ? 'bg-primary-gold' : 'bg-success-green'}`} />
            {modeLabel}
          </span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-dark-charcoal/70">{t('settings.aboutPlatform')}</span>
          <span className="font-medium text-dark-charcoal">{navigator.platform}</span>
        </div>
      </div>

      <div className="border border-secondary-gray rounded-xl p-4 shadow-sm bg-white/40">
        <h4 className="font-medium text-dark-charcoal mb-3">{t('settings.aboutLicense')}</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-dark-charcoal/70">{t('settings.aboutLicensedTo')}</span>
            <span className="font-medium">{t('settings.aboutCompanyName')}</span>
          </div>
        </div>
      </div>

      {updateState?.stage === 'available' && (
        <div className="border border-primary-gold/50 rounded-lg p-4 bg-primary-gold/5">
          <div className="flex items-center gap-2 text-primary-gold mb-2">
            <AlertTriangle size={18} />
            <span className="font-medium">{t('settings.aboutUpdateAvailable')}</span>
          </div>
          <p className="text-sm text-dark-charcoal/70">
            {t('settings.aboutUpdateHint')}
            {updateState.version ? ` (${updateState.version})` : ''}
          </p>

          {updateState.notes && (
            <div className="mt-3 text-sm text-dark-charcoal/70">
              <div className="font-medium text-dark-charcoal/80 mb-1">الميزات / الإصلاحات</div>
              <pre className="whitespace-pre-wrap bg-white/60 border border-secondary-gray/40 rounded-lg p-3 text-xs leading-relaxed">
                {updateState.notes}
              </pre>
            </div>
          )}

          <button
            type="button"
            onClick={handleDownloadUpdate}
            className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-gold text-white font-medium hover:bg-accent-sand"
          >
            <Download size={18} />
            تنزيل التحديث
          </button>
        </div>
      )}

      {updateState?.stage === 'none' && (
        <div className="border border-success-green/50 rounded-lg p-4 bg-success-green/5">
          <div className="flex items-center gap-2 text-success-green">
            <CheckCircle size={18} />
            <span className="font-medium">{t('settings.aboutUpToDate')}</span>
          </div>
        </div>
      )}

      {updateState?.stage === 'downloading' && (
        <div className="border border-primary-gold/50 rounded-lg p-4 bg-primary-gold/5">
          <div className="flex items-center gap-2 text-primary-gold mb-2">
            <RefreshCw size={18} className="animate-spin" />
            <span className="font-medium">جاري تنزيل التحديث</span>
          </div>
          {updateState.percent != null && (
            <div className="mt-2">
              <div className="w-full h-2.5 bg-secondary-gray/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-gold rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(updateState.percent, 100)}%` }}
                />
              </div>
              <p className="text-sm text-dark-charcoal/70 mt-1 text-center">{updateState.percent.toFixed(1)}%</p>
            </div>
          )}
        </div>
      )}

      {updateState?.stage === 'downloaded' && (
        <div className="border border-success-green/50 rounded-lg p-4 bg-success-green/5">
          <div className="flex items-center gap-2 text-success-green mb-2">
            <CheckCircle size={18} />
            <span className="font-medium">التحديث جاهز للتثبيت</span>
          </div>
          <button
            type="button"
            onClick={handleInstallUpdate}
            className="px-4 py-2 rounded-lg bg-primary-gold text-white font-medium hover:bg-accent-sand"
          >
            إعادة التشغيل وتثبيت التحديث
          </button>
        </div>
      )}

      {updateState?.stage === 'error' && (
        <div className="border border-alert-red/50 rounded-lg p-4 bg-alert-red/5">
          <div className="flex items-center gap-2 text-alert-red mb-2">
            <AlertTriangle size={18} />
            <span className="font-medium">فشل التحديث</span>
          </div>
          <p className="text-sm text-dark-charcoal/70">{updateState.error || 'Unknown error'}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-secondary-gray text-dark-charcoal">
          <input
            type="checkbox"
            checked={autoUpdateCheckEnabled}
            onChange={handleToggleAutoUpdateCheck}
            className="w-4 h-4 accent-primary-gold"
          />
          <span className="text-sm">{t('settings.aboutAutoUpdateCheck')}</span>
        </label>
        <button
          type="button"
          onClick={handleCheckUpdates}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-gold text-white font-medium hover:bg-accent-sand disabled:opacity-50"
        >
          <RefreshCw size={18} className={checking ? 'animate-spin' : ''} />
          {checking ? t('settings.aboutChecking') : t('settings.aboutCheckUpdates')}
        </button>
        <button
          type="button"
          onClick={handleCopySystemInfo}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-secondary-gray text-dark-charcoal hover:bg-secondary-gray/20 font-medium"
        >
          <Copy size={18} />
          {t('settings.aboutCopyInfo')}
        </button>
      </div>

      <div className="text-center text-xs text-dark-charcoal/45 pt-6 border-t border-secondary-gray/30 space-y-1.5">
        <p>&copy; {new Date().getFullYear()} {t('settings.aboutFooterRights')}</p>
        <p className="text-[11px] tracking-wide text-dark-charcoal/55 uppercase">
          {t('settings.aboutFooterDeveloper')}
        </p>
      </div>
    </div>
  );
}
