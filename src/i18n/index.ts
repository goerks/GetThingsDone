import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import de from './de.json';
import fr from './fr.json';
import it from './it.json';

export const LANGUAGES = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' }
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'getitdone.language';

function isSupported(code: string | null | undefined): code is LanguageCode {
  return LANGUAGES.some((language) => language.code === code);
}

export function detectLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) return stored;
  } catch {
    // ignore storage problems and fall back to the browser language
  }
  const preferred = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase();
  return isSupported(preferred) ? preferred : 'en';
}

export function setLanguage(code: LanguageCode): void {
  void i18n.changeLanguage(code);
  document.documentElement.lang = code;
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // the choice just will not be remembered
  }
}

export function initI18n(language: LanguageCode = detectLanguage()): typeof i18n {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
      it: { translation: it }
    },
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });
  document.documentElement.lang = language;
  return i18n;
}

export default i18n;
