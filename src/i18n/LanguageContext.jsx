import React, { createContext, useContext, useState, useEffect } from 'react';
import en from './en';
import es from './es';
import fr from './fr';
import de from './de';
import hi from './hi';
import ja from './ja';
import zh from './zh';

const LanguageContext = createContext();

export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸', native: 'English' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', native: 'Español' },
  { code: 'fr', name: 'French', flag: '🇫🇷', native: 'Français' },
  { code: 'de', name: 'German', flag: '🇩🇪', native: 'Deutsch' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', native: '日本語' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', native: '中文' }
];

export const TRANSLATIONS = {
  en,
  es,
  fr,
  de,
  hi,
  ja,
  zh
};

export const LanguageProvider = ({ children }) => {
  const [currentLang, setCurrentLang] = useState(() => {
    try {
      const saved = localStorage.getItem('pc_app_language');
      return saved && TRANSLATIONS[saved] ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pc_app_language', currentLang);
    } catch {
      // Ignore localStorage errors if restricted
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = currentLang;
    }
  }, [currentLang]);

  const t = (key, fallback = '') => {
    return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS.en?.[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{
      currentLang,
      setLanguage: setCurrentLang,
      languages: LANGUAGES,
      t
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      currentLang: 'en',
      setLanguage: () => {},
      languages: LANGUAGES,
      t: (key, fallback = '') => TRANSLATIONS.en?.[key] || fallback || key
    };
  }
  return context;
};

export default LanguageContext;
