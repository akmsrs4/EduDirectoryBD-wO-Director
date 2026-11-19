import React, { createContext, useContext, useState } from 'react';
import type { UiLanguage } from '../types/institution';

interface LanguageContextValue {
  lang: UiLanguage;
  setLang: (lang: UiLanguage) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const LANG_KEY = 'edudirectory_ui_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UiLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      return saved === 'en' ? 'en' : 'bn';
    } catch {
      return 'bn';
    }
  });

  function setLang(next: UiLanguage) {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Ignore
    }
  }

  function toggleLang() {
    setLang(lang === 'bn' ? 'en' : 'bn');
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
