import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, FolderOpen, Trash2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAllSettings, setSettings, SETTINGS_KEYS } from '../../../services/settingsService';

interface BackupEntry {
  name: string;
  path: string;
  size: number;
  createdAt: string;
  isFull: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupSettings() {
  const { t } = useTranslation();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [includeDocuments, setIncludeDocuments] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupList, setBackupList] = useState<BackupEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [savingAuto, setSavingAuto] = useState(false);

  const loadSettings = async () => {
    const s = await getAllSettings();
    setAutoBackupEnabled((s[SETTINGS_KEYS.AUTO_BACKUP_ENABLED] ?? '0') === '1');
  };

  const loadBackupList = async () => {
    setLoadingList(true);
    try {
      const res = await window.electronAPI?.backupList?.();
      setBackupList(res?.success && res?.data ? res.data : []);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    loadBackupList();
  }, []);

  const handleAutoBackupToggle = async () => {
    setSavingAuto(true);
    try {
      const next = !autoBackupEnabled;
      const result = await setSettings({ [SETTINGS_KEYS.AUTO_BACKUP_ENABLED]: next ? '1' : '0' });
      if (result.success) {
        setAutoBackupEnabled(next);
        toast.success(next ? t('settings.saved') : t('settings.saved'));
      } else toast.error(result.error ?? t('settings.saveFailed'));
    } finally {
      setSavingAuto(false);
    }
  };

  const handleBackupToFolder = async () => {
    setBackingUp(true);
    try {
      const res = await window.electronAPI?.backupCreate?.({ toDedicatedFolder: true, includeDocuments });
      if (res?.success) {
        toast.success(t('settings.backupSuccess'));
        loadBackupList();
      } else if (!res?.canceled) {
        toast.error(res?.error || t('settings.backupFailed'));
      }
    } catch {
      toast.error(t('settings.backupFailed'));
    } finally {
      setBackingUp(false);
    }
  };

  const handleExport = async () => {
    setBackingUp(true);
    try {
      const res = await window.electronAPI?.backupCreate?.();
      if (res?.canceled) {
        // user cancelled
      } else if (res?.success) {
        toast.success(t('settings.backupSuccess'));
      } else {
        toast.error(res?.error || t('settings.backupFailed'));
      }
    } catch {
      toast.error(t('settings.backupFailed'));
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreFromFile = async () => {
    if (!window.confirm(t('settings.restoreConfirm'))) return;
    setRestoring(true);
    try {
      const res = await window.electronAPI?.backupRestore?.();
      if (res?.canceled) {
        // user cancelled
      } else if (res?.success) {
        toast.success(t('settings.restoreSuccess'));
        window.location.reload();
      } else {
        toast.error(res?.error || t('settings.restoreFailed'));
      }
    } catch {
      toast.error(t('settings.restoreFailed'));
    } finally {
      setRestoring(false);
    }
  };

  const handleRestoreFromList = async (entry: BackupEntry) => {
    if (!window.confirm(t('settings.backupRestoreConfirm'))) return;
    setRestoring(true);
    try {
      const res = await window.electronAPI?.backupRestoreFromPath?.(entry.path);
      if (res?.success) {
        toast.success(t('settings.restoreSuccess'));
        window.location.reload();
      } else {
        toast.error(res?.error || t('settings.restoreFailed'));
      }
    } catch {
      toast.error(t('settings.restoreFailed'));
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async (name: string) => {
    if (!window.confirm(t('settings.deleteBackup') + '?')) return;
    try {
      const res = await window.electronAPI?.backupDelete?.(name);
      if (res?.success) {
        toast.success(t('settings.backupDeleted'));
        loadBackupList();
      } else toast.error(res?.error || t('settings.restoreFailed'));
    } catch {
      toast.error(t('settings.restoreFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-dark-charcoal">{t('settings.backupTitle')}</h2>
      <p className="text-secondary-gray text-sm">{t('settings.backupDesc')}</p>

      <div className="flex items-center justify-between p-4 bg-white border border-secondary-gray rounded-lg max-w-xl">
        <div>
          <p className="font-medium text-dark-charcoal">{t('settings.autoBackupEnabled')}</p>
          <p className="text-sm text-secondary-gray">{t('settings.autoBackupEnabledDesc')}</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoBackupEnabled}
            onChange={handleAutoBackupToggle}
            disabled={savingAuto}
            className="rounded border-secondary-gray text-primary-gold focus:ring-primary-gold"
          />
          <span className="text-sm">{t('settings.enabled')}</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        <div className="p-6 border border-secondary-gray rounded-xl bg-white flex flex-col">
          <div className="w-14 h-14 rounded-full bg-primary-gold/15 flex items-center justify-center mb-4">
            <FolderOpen size={28} className="text-primary-gold" />
          </div>
          <h3 className="font-medium text-dark-charcoal mb-2">{t('settings.backupToFolder')}</h3>
          <p className="text-sm text-secondary-gray mb-4">{t('settings.backupToFolderDesc')}</p>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDocuments}
              onChange={(e) => setIncludeDocuments(e.target.checked)}
              className="rounded border-secondary-gray text-primary-gold"
            />
            <span className="text-sm">{t('settings.includeDocuments')}</span>
          </label>
          <button
            type="button"
            onClick={handleBackupToFolder}
            disabled={backingUp}
            className="mt-auto px-4 py-2 rounded-lg bg-primary-gold text-white font-medium hover:bg-accent-sand disabled:opacity-50"
          >
            {backingUp ? t('settings.creatingBackup') : t('settings.createBackup')}
          </button>
        </div>

        <div className="p-6 border border-secondary-gray rounded-xl bg-white flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-secondary-gray/20 flex items-center justify-center mb-4">
            <Download size={28} className="text-dark-charcoal" />
          </div>
          <h3 className="font-medium text-dark-charcoal mb-2">{t('settings.backupExport')}</h3>
          <p className="text-sm text-secondary-gray mb-4">{t('settings.backupExportDesc')}</p>
          <button
            type="button"
            onClick={handleExport}
            disabled={backingUp}
            className="mt-auto px-4 py-2 rounded-lg border border-secondary-gray font-medium hover:bg-secondary-gray/10 disabled:opacity-50"
          >
            {backingUp ? t('settings.creatingBackup') : t('settings.backupExport')}
          </button>
        </div>
      </div>

      <div className="border border-secondary-gray rounded-lg overflow-hidden">
        <h3 className="font-medium text-dark-charcoal p-4 border-b border-secondary-gray">{t('settings.backupListTitle')}</h3>
        {loadingList ? (
          <p className="p-4 text-secondary-gray text-sm">{t('settings.loading')}</p>
        ) : backupList.length === 0 ? (
          <p className="p-4 text-secondary-gray text-sm">{t('settings.backupListEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-secondary-gray/10">
                <tr>
                  <th className="px-4 py-3 font-medium text-dark-charcoal">{t('settings.backupName')}</th>
                  <th className="px-4 py-3 font-medium text-dark-charcoal">{t('settings.backupDate')}</th>
                  <th className="px-4 py-3 font-medium text-dark-charcoal">{t('settings.backupSize')}</th>
                  <th className="px-4 py-3 font-medium text-dark-charcoal w-40">{t('settings.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {backupList.map((entry) => (
                  <tr key={entry.name} className="border-t border-secondary-gray/50 hover:bg-secondary-gray/5">
                    <td className="px-4 py-2.5 font-medium">{entry.name}</td>
                    <td className="px-4 py-2.5">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5">{formatSize(entry.size)}</td>
                    <td className="px-4 py-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestoreFromList(entry)}
                        disabled={restoring}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-medium hover:bg-amber-200 disabled:opacity-50"
                      >
                        <RotateCcw size={14} /> {t('settings.restoreFromList')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBackup(entry.name)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100"
                      >
                        <Trash2 size={14} /> {t('settings.deleteBackup')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-6 border border-amber-200 rounded-xl bg-amber-50/50 max-w-xl">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <Upload size={28} className="text-amber-700" />
          </div>
          <div>
            <h3 className="font-medium text-dark-charcoal">{t('settings.restore')}</h3>
            <p className="text-sm text-secondary-gray">{t('settings.restoreDesc')}</p>
            <button
              type="button"
              onClick={handleRestoreFromFile}
              disabled={restoring}
              className="mt-2 px-4 py-2 rounded-lg border-2 border-amber-600 text-amber-700 font-medium hover:bg-amber-100 disabled:opacity-50"
            >
              {restoring ? t('settings.restoring') : t('settings.restore')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
