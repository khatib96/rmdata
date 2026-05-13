import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UiLanguage = 'ar' | 'en';

interface LanguageState {
  language: UiLanguage;
  setLanguage: (lang: UiLanguage) => void;
  /** Direction derived from language: rtl for ar, ltr for en */
  dir: 'rtl' | 'ltr';
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'ar',
      dir: 'rtl',
      setLanguage: (lang) =>
        set({ language: lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }),
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
