import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '../locales/ar.json';
import en from '../locales/en.json';
import type { UiLanguage } from '../store/languageStore';

export const defaultNS = 'translation';

const resources = {
  ar: { [defaultNS]: ar },
  en: { [defaultNS]: en },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'ar',
  fallbackLng: 'ar',
  defaultNS,
  ns: [defaultNS],
  interpolation: {
    escapeValue: false,
  },
});

/** Call when language setting changes (e.g. from settings or languageStore) */
export function setI18nLanguage(lang: UiLanguage): void {
  i18n.changeLanguage(lang);
}

export default i18n;
