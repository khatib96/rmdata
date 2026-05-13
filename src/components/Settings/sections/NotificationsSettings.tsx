import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getAllSettings, setSettings, SETTINGS_KEYS } from '../../../services/settingsService';

export default function NotificationsSettings() {
  const { t } = useTranslation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(true);
  const [expiryWarningDays, setExpiryWarningDays] = useState(30);
  const [showGreenExpiry, setShowGreenExpiry] = useState(true);
  const [showYellowExpiry, setShowYellowExpiry] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getAllSettings();
      if (!cancelled) {
        setNotificationsEnabled((s[SETTINGS_KEYS.NOTIFICATIONS_ENABLED] ?? '1') === '1');
        setNotificationSoundEnabled((s[SETTINGS_KEYS.NOTIFICATION_SOUND_ENABLED] ?? '1') === '1');
        setDesktopNotificationsEnabled((s[SETTINGS_KEYS.DESKTOP_NOTIFICATIONS_ENABLED] ?? '1') === '1');
        setExpiryWarningDays(Math.max(1, parseInt(s[SETTINGS_KEYS.EXPIRY_WARNING_DAYS] ?? '30', 10) || 30));
        setShowGreenExpiry((s[SETTINGS_KEYS.SHOW_GREEN_EXPIRY] ?? '1') === '1');
        setShowYellowExpiry((s[SETTINGS_KEYS.SHOW_YELLOW_EXPIRY] ?? '1') === '1');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await setSettings({
        [SETTINGS_KEYS.NOTIFICATIONS_ENABLED]: notificationsEnabled ? '1' : '0',
        [SETTINGS_KEYS.NOTIFICATION_SOUND_ENABLED]: notificationSoundEnabled ? '1' : '0',
        [SETTINGS_KEYS.DESKTOP_NOTIFICATIONS_ENABLED]: desktopNotificationsEnabled ? '1' : '0',
        [SETTINGS_KEYS.EXPIRY_WARNING_DAYS]: String(Math.max(1, expiryWarningDays)),
        [SETTINGS_KEYS.SHOW_GREEN_EXPIRY]: showGreenExpiry ? '1' : '0',
        [SETTINGS_KEYS.SHOW_YELLOW_EXPIRY]: showYellowExpiry ? '1' : '0',
      });
      if (result.success) toast.success(t('settings.notificationsSaved'));
      else toast.error(result.error ?? t('settings.saveFailed'));

      if (result.success) {
        window.dispatchEvent(new CustomEvent('expiry-ui-settings-changed'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-secondary-gray">{t('settings.loading')}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-dark-charcoal">{t('settings.notificationsTitle')}</h2>

      <form onSubmit={handleSave} className="space-y-6 max-w-lg">
        <div className="flex items-center justify-between p-4 bg-white border border-secondary-gray rounded-lg">
          <div>
            <p className="font-medium text-dark-charcoal">{t('settings.notificationsEnabled')}</p>
            <p className="text-sm text-secondary-gray">{t('settings.notificationsEnabledDesc')}</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="rounded border-secondary-gray text-primary-gold focus:ring-primary-gold"
            />
            <span className="text-sm">{t('settings.enabled')}</span>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-white border border-secondary-gray rounded-lg">
          <div>
            <p className="font-medium text-dark-charcoal">{t('settings.notificationSoundEnabled')}</p>
            <p className="text-sm text-secondary-gray">{t('settings.notificationSoundEnabledDesc')}</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationSoundEnabled}
              onChange={(e) => setNotificationSoundEnabled(e.target.checked)}
              className="rounded border-secondary-gray text-primary-gold focus:ring-primary-gold"
            />
            <span className="text-sm">{t('settings.enabled')}</span>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-white border border-secondary-gray rounded-lg">
          <div>
            <p className="font-medium text-dark-charcoal">{t('settings.desktopNotificationsEnabled')}</p>
            <p className="text-sm text-secondary-gray">{t('settings.desktopNotificationsEnabledDesc')}</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={desktopNotificationsEnabled}
              onChange={(e) => setDesktopNotificationsEnabled(e.target.checked)}
              className="rounded border-secondary-gray text-primary-gold focus:ring-primary-gold"
            />
            <span className="text-sm">{t('settings.enabled')}</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('settings.warningDays')}</label>
          <p className="text-xs text-secondary-gray mb-2">{t('settings.warningDaysHint')}</p>
          <input
            type="number"
            min={1}
            max={365}
            value={expiryWarningDays}
            onChange={(e) => setExpiryWarningDays(parseInt(e.target.value, 10) || 30)}
            className="w-24 px-3 py-2 border border-secondary-gray rounded-lg"
          />
        </div>

        <div className="space-y-3 p-4 bg-amber-50/50 border border-amber-200 rounded-lg">
          <p className="font-medium text-dark-charcoal">{t('settings.showExpiryStates')}</p>
          <p className="text-sm text-secondary-gray">{t('settings.redAlwaysVisible')}</p>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">{t('settings.showGreen')}</span>
            <input
              type="checkbox"
              checked={showGreenExpiry}
              onChange={(e) => setShowGreenExpiry(e.target.checked)}
              className="rounded border-secondary-gray text-primary-gold focus:ring-primary-gold"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">{t('settings.showYellow')}</span>
            <input
              type="checkbox"
              checked={showYellowExpiry}
              onChange={(e) => setShowYellowExpiry(e.target.checked)}
              className="rounded border-secondary-gray text-primary-gold focus:ring-primary-gold"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary-gold text-white font-medium hover:bg-accent-sand disabled:opacity-50"
        >
          {saving ? t('settings.saving') : t('settings.save')}
        </button>
      </form>
    </div>
  );
}
