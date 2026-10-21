import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type Direction = 'ltr' | 'rtl';

export const DEFAULT_LANGUAGE: Language = 'en';
/** Must match the pre-paint script in index.html. */
export const LANGUAGE_STORAGE_KEY = 'abr.lang';

export const resources = {
  en: { translation: en },
  ar: { translation: ar },
} as const;

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function directionOf(language: Language): Direction {
  return language === 'ar' ? 'rtl' : 'ltr';
}

export function readStoredLanguage(): Language | null {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the choice then lasts for the session.
  }
}

export function applyDocumentLanguage(language: Language): void {
  document.documentElement.lang = language;
  document.documentElement.dir = directionOf(language);
}

export function currentLanguage(): Language {
  return isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE;
}

export async function changeLanguage(language: Language): Promise<void> {
  await i18n.changeLanguage(language);
}

i18n.on('languageChanged', (language) => {
  if (!isLanguage(language)) return;
  applyDocumentLanguage(language);
  storeLanguage(language);
});

void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage() ?? DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  initAsync: false,
  interpolation: { escapeValue: false }, // React already escapes output.
  returnNull: false,
  showSupportNotice: false,
});

applyDocumentLanguage(currentLanguage());

export default i18n;
