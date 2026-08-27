/**
 * Lightweight translation service.
 *
 * Uses the MyMemory Translation API (https://mymemory.translated.net/) — it's free,
 * requires no API key, and works directly from the browser (CORS-enabled).
 * Anonymous usage is capped at ~5000 words/day per IP, which is plenty for a
 * UI with a few dozen strings, since every translated string is cached
 * (in-memory + localStorage) so it's only ever fetched once per language.
 *
 * If you outgrow the free tier or want higher quality translations, swap the
 * body of `fetchTranslation` for Google Cloud Translation, Azure Translator,
 * or DeepL — everything else (caching, queueing, the React hook) stays the same.
 */

const CACHE_KEY = "app_translation_cache_v1";

type TranslationCache = Record<string, string>; // `${lang}::${text}` -> translated text

function loadCache(): TranslationCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: TranslationCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable — translations just won't persist across reloads
  }
}

const cache: TranslationCache = loadCache();

// Cap concurrent network requests so we don't fire dozens at once when the
// language changes and every string on screen needs translating.
const MAX_CONCURRENT = 4;
let activeRequests = 0;
const queue: Array<() => void> = [];

function runNext() {
  if (activeRequests >= MAX_CONCURRENT || queue.length === 0) return;
  const job = queue.shift();
  if (job) job();
}

async function fetchTranslation(text: string, targetLang: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation request failed: ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || typeof translated !== "string") throw new Error("No translation returned");
  // MyMemory sometimes returns a quota/error notice inside translatedText instead of erroring
  if (translated.toUpperCase().includes("MYMEMORY WARNING") || translated.toUpperCase().includes("INVALID")) {
    throw new Error("Translation service warning");
  }
  return translated;
}

/** Synchronous cache lookup — returns null if not yet translated. */
export function getCachedTranslation(text: string, targetLang: string): string | null {
  if (!text || targetLang === "en") return text;
  return cache[`${targetLang}::${text}`] ?? null;
}

/**
 * Kicks off a translation (if not cached) and calls `onReady` once it arrives.
 * Fails silently on error — callers should keep showing the English fallback.
 */
export function translate(text: string, targetLang: string, onReady: (translated: string) => void): void {
  if (!text || targetLang === "en") return;
  const key = `${targetLang}::${text}`;
  const cached = cache[key];
  if (cached) {
    onReady(cached);
    return;
  }

  queue.push(() => {
    activeRequests++;
    fetchTranslation(text, targetLang)
      .then((translated) => {
        cache[key] = translated;
        saveCache(cache);
        onReady(translated);
      })
      .catch(() => {
        // Leave it untranslated; the UI keeps the English text as a fallback
      })
      .finally(() => {
        activeRequests--;
        runNext();
      });
  });
  runNext();
}
