import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getAllSettings, setSetting, SETTINGS_KEYS } from '../../../services/settingsService';
import { useLanguageStore } from '../../../store/languageStore';
import type { UiLanguage } from '../../../store/languageStore';

const LANGUAGES: { value: UiLanguage; labelAr: string; labelEn: string }[] = [
  { value: 'ar', labelAr: 'العربية', labelEn: 'Arabic' },
  { value: 'en', labelAr: 'الإنجليزية', labelEn: 'English' },
];

export default function LanguageSettings() {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<UiLanguage>('ar');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const setUiLanguage = useLanguageStore((s) => s.setLanguage);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getAllSettings();
      const saved = s[SETTINGS_KEYS.DEFAULT_LANGUAGE] ?? 'ar';
      if (!cancelled) setLanguage(saved === 'en' ? 'en' : 'ar');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await setSetting(SETTINGS_KEYS.DEFAULT_LANGUAGE, language);
      if (result.success) {
        setUiLanguage(language);
        toast.success(t('settings.languageSaved'));
      } else {
        toast.error(result.error ?? t('settings.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-secondary-gray">{t('settings.loading')}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-dark-charcoal">{t('settings.language')}</h2>
      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-dark-charcoal mb-1">{t('settings.defaultInterfaceLanguage')}</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as UiLanguage)}
            className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.labelAr} — {l.labelEn}</option>
            ))}
          </select>
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
