import i18next from 'i18next';
import en from '../i18n/en.json';
import vi from '../i18n/vi.json';
import { saveManager } from './SaveManager';

let ready = false;

export const initI18n = async (): Promise<void> => {
  if (ready) return;
  await i18next.init({
    lng: saveManager.language,
    fallbackLng: 'vi',
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  ready = true;
};

export type LangCode = 'vi' | 'en';

export const setLanguage = async (lang: LangCode): Promise<void> => {
  saveManager.setLanguage(lang);
  await i18next.changeLanguage(lang);
};

export const getLanguage = (): LangCode => (i18next.language as LangCode) ?? 'vi';

export const t = (key: string, vars?: Record<string, string | number>): string => {
  if (!ready) return key;
  return i18next.t(key, vars) as string;
};
