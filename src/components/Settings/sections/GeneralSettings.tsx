import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getAllSettings, setSettings, SETTINGS_KEYS } from '../../../services/settingsService';

export default function GeneralSettings() {
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getAllSettings();
      if (!cancelled) {
        setCompanyName(s[SETTINGS_KEYS.COMPANY_NAME] ?? '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await setSettings({ [SETTINGS_KEYS.COMPANY_NAME]: companyName.trim() || t('settings.companyPlaceholder') });
      if (result.success) toast.success(t('settings.saved'));
      else toast.error(result.error ?? t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-secondary-gray">{t('settings.loading')}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-dark-charcoal">{t('settings.general')}</h2>
      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('settings.companyName')}</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold"
            placeholder={t('settings.companyPlaceholder')}
          />
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
