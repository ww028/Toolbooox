import {
  getIndexedDbValue,
  setIndexedDbValue
} from "../storage/indexedDbKeyValue";

export type Locale = "zh-CN" | "en";

const LOCALE_STORAGE_KEY = "toolbooox.locale";
const defaultLocale: Locale = "zh-CN";

function isLocale(value: unknown): value is Locale {
  return value === "zh-CN" || value === "en";
}

export function getDefaultLocale(): Locale {
  return defaultLocale;
}

export async function getSavedLocale(): Promise<Locale> {
  const savedLocale = await getIndexedDbValue(LOCALE_STORAGE_KEY);
  return isLocale(savedLocale) ? savedLocale : defaultLocale;
}

export async function saveLocale(locale: Locale): Promise<void> {
  await setIndexedDbValue(LOCALE_STORAGE_KEY, locale);
}
