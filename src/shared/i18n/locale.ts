export type Locale = "zh-CN" | "en";

const LOCALE_STORAGE_KEY = "toolbooox.locale";
const defaultLocale: Locale = "zh-CN";

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function isLocale(value: unknown): value is Locale {
  return value === "zh-CN" || value === "en";
}

export function getDefaultLocale(): Locale {
  return defaultLocale;
}

export async function getSavedLocale(): Promise<Locale> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(LOCALE_STORAGE_KEY);
    return isLocale(result[LOCALE_STORAGE_KEY]) ? result[LOCALE_STORAGE_KEY] : defaultLocale;
  }

  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(savedLocale) ? savedLocale : defaultLocale;
}

export async function saveLocale(locale: Locale): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [LOCALE_STORAGE_KEY]: locale });
    return;
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
