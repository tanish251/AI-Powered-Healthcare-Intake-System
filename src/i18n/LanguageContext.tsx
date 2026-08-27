import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { getCachedTranslation, translate } from "./translate";

type LanguageContextValue = {
  /** Current language code, e.g. "en" | "hi" | "mr" | "gu" */
  language: string;
  setLanguage: (code: string) => void;
  /** Translate a piece of English UI text into the current language. */
  t: (text: string) => string;
  /** True while one or more strings are still being fetched from the API. */
  isTranslating: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "app_selected_language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "en";
    } catch {
      return "en";
    }
  });

  const [, forceRender] = useState(0);
  const pendingCount = useRef(0);
  const [isTranslating, setIsTranslating] = useState(false);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore write failures (private browsing, quota, etc.)
    }
  }, []);

  const t = useCallback(
    (text: string): string => {
      if (!text || language === "en") return text;

      const cached = getCachedTranslation(text, language);
      if (cached) return cached;

      // Not cached yet: kick off a fetch and show the English text meanwhile.
      pendingCount.current += 1;
      setIsTranslating(true);
      translate(text, language, () => {
        pendingCount.current = Math.max(0, pendingCount.current - 1);
        if (pendingCount.current === 0) setIsTranslating(false);
        forceRender((n) => n + 1); // re-render now that a translation arrived
      });
      return text;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isTranslating }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
