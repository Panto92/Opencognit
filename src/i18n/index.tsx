import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { de } from './de';
import { en } from './en';

type Language = 'de' | 'en';

const translations = { de, en };

type Translations = typeof de | typeof en;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // 1. Gespeicherte Präferenz
    const saved = localStorage.getItem('opencognit_language');
    if (saved === 'de' || saved === 'en') return saved;
    // 2. Browser-Sprache erkennen
    const browserLang = navigator.language?.slice(0, 2).toLowerCase();
    if (browserLang === 'de') return 'de';
    // 3. Fallback: Englisch (global)
    return 'en';
  });

  const isFirstRender = useRef(true);

  useEffect(() => {
    localStorage.setItem('opencognit_language', language);
    document.documentElement.lang = language;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const path = window.location.pathname;
    if (path.includes('/auth/') || path.includes('/login') || path.includes('/signup')) {
      return;
    }

    // Persist to backend so agents respond in the right language
    const token = localStorage.getItem('opencognit_token');
    fetch('/api/einstellungen/ui_language', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ wert: language, unternehmenId: '' }),
    }).catch(() => {/* fire-and-forget */});
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const tx = translations[language];

  // Hybrid t: works as function t('nav.dashboard') AND object t.nav.dashboard
  const t = Object.assign(
    (path: string) => {
      const keys = path.split('.');
      let value: any = tx;
      for (const key of keys) {
        value = value[key];
        if (value === undefined) return path;
      }
      return value;
    },
    tx,
  ) as Translations & ((path: string) => string);

  const isRTL = false; // Can be extended for Arabic/Hebrew support

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Helper hook for translations
export function useTranslation() {
  const { t, language, setLanguage } = useI18n();
  return { t, language, setLanguage };
}
