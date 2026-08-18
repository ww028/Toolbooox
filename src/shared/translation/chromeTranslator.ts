export const TRANSLATION_LANGUAGE_OPTIONS = [
  { code: "zh-Hans", label: "简体中文 / Chinese" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語 / Japanese" },
  { code: "ko", label: "한국어 / Korean" },
  { code: "fr", label: "Français / French" },
  { code: "de", label: "Deutsch / German" },
  { code: "es", label: "Español / Spanish" },
  { code: "it", label: "Italiano / Italian" },
  { code: "pt", label: "Português / Portuguese" },
  { code: "ru", label: "Русский / Russian" }
] as const;

export type TranslationLanguageCode = (typeof TRANSLATION_LANGUAGE_OPTIONS)[number]["code"];

type TranslatorAvailability = "available" | "downloadable" | "downloading" | "unavailable";

type ChromeTranslatorInstance = {
  translate(text: string): Promise<string>;
  destroy?: () => void;
};

type ChromeTranslatorConstructor = {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<TranslatorAvailability | "readily" | "after-download" | "no">;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitorTarget: EventTarget) => void;
  }): Promise<ChromeTranslatorInstance>;
};

const MAX_TRANSLATION_RESULT_CACHE_ITEMS = 30;
const availabilityCache = new Map<string, true>();
const translatorCache = new Map<
  string,
  {
    readonly instance?: ChromeTranslatorInstance;
    readonly createPromise?: Promise<ChromeTranslatorInstance>;
  }
>();
const translationResultCache = new Map<string, string>();

function getChromeTranslator(): ChromeTranslatorConstructor | null {
  const globalScope = globalThis as unknown as {
    Translator?: ChromeTranslatorConstructor;
  };

  return globalScope.Translator ?? null;
}

function isAvailabilityUsable(availability: string): boolean {
  return (
    availability === "available" ||
    availability === "downloadable" ||
    availability === "downloading" ||
    availability === "readily" ||
    availability === "after-download"
  );
}

function getLanguagePairKey(
  sourceLanguage: TranslationLanguageCode,
  targetLanguage: TranslationLanguageCode
): string {
  return `${sourceLanguage}->${targetLanguage}`;
}

function getTranslationResultCacheKey(options: {
  readonly sourceLanguage: TranslationLanguageCode;
  readonly targetLanguage: TranslationLanguageCode;
  readonly text: string;
}): string {
  return `${options.sourceLanguage}\u0000${options.targetLanguage}\u0000${options.text}`;
}

function rememberTranslationResult(cacheKey: string, translatedText: string): void {
  translationResultCache.delete(cacheKey);
  translationResultCache.set(cacheKey, translatedText);

  if (translationResultCache.size <= MAX_TRANSLATION_RESULT_CACHE_ITEMS) {
    return;
  }

  const oldestCacheKey = translationResultCache.keys().next().value;

  if (oldestCacheKey) {
    translationResultCache.delete(oldestCacheKey);
  }
}

async function ensureLanguagePairAvailable(
  translatorConstructor: ChromeTranslatorConstructor,
  sourceLanguage: TranslationLanguageCode,
  targetLanguage: TranslationLanguageCode
): Promise<void> {
  const languagePairKey = getLanguagePairKey(sourceLanguage, targetLanguage);

  if (availabilityCache.has(languagePairKey)) {
    return;
  }

  const availability = await translatorConstructor.availability({
    sourceLanguage,
    targetLanguage
  });

  if (!isAvailabilityUsable(availability)) {
    throw new Error("TRANSLATOR_UNAVAILABLE");
  }

  availabilityCache.set(languagePairKey, true);
}

async function getOrCreateTranslator(
  translatorConstructor: ChromeTranslatorConstructor,
  sourceLanguage: TranslationLanguageCode,
  targetLanguage: TranslationLanguageCode
): Promise<ChromeTranslatorInstance> {
  const languagePairKey = getLanguagePairKey(sourceLanguage, targetLanguage);
  const cachedTranslator = translatorCache.get(languagePairKey);

  if (cachedTranslator?.instance) {
    return cachedTranslator.instance;
  }

  if (cachedTranslator?.createPromise) {
    return cachedTranslator.createPromise;
  }

  const createPromise = translatorConstructor
    .create({
      sourceLanguage,
      targetLanguage
    })
    .then((translator) => {
      translatorCache.set(languagePairKey, { instance: translator });
      return translator;
    })
    .catch((error: unknown) => {
      translatorCache.delete(languagePairKey);
      throw error;
    });

  translatorCache.set(languagePairKey, { createPromise });
  return createPromise;
}

export async function prewarmChromeTranslator(options: {
  readonly sourceLanguage: TranslationLanguageCode;
  readonly targetLanguage: TranslationLanguageCode;
}): Promise<boolean> {
  const translatorConstructor = getChromeTranslator();

  if (!translatorConstructor) {
    return false;
  }

  try {
    await ensureLanguagePairAvailable(
      translatorConstructor,
      options.sourceLanguage,
      options.targetLanguage
    );
    await getOrCreateTranslator(
      translatorConstructor,
      options.sourceLanguage,
      options.targetLanguage
    );
    return true;
  } catch {
    return false;
  }
}

export async function translateWithChromeTranslator(options: {
  readonly sourceLanguage: TranslationLanguageCode;
  readonly targetLanguage: TranslationLanguageCode;
  readonly text: string;
}): Promise<string> {
  const translationResultCacheKey = getTranslationResultCacheKey(options);
  const cachedTranslationResult = translationResultCache.get(translationResultCacheKey);

  if (cachedTranslationResult !== undefined) {
    return cachedTranslationResult;
  }

  const translatorConstructor = getChromeTranslator();

  if (!translatorConstructor) {
    throw new Error("TRANSLATOR_UNSUPPORTED");
  }

  await ensureLanguagePairAvailable(
    translatorConstructor,
    options.sourceLanguage,
    options.targetLanguage
  );
  const translator = await getOrCreateTranslator(
    translatorConstructor,
    options.sourceLanguage,
    options.targetLanguage
  );
  const translatedText = await translator.translate(options.text);
  rememberTranslationResult(translationResultCacheKey, translatedText);
  return translatedText;
}

export function resetChromeTranslatorCaches(): void {
  for (const cachedTranslator of translatorCache.values()) {
    cachedTranslator.instance?.destroy?.();
  }

  availabilityCache.clear();
  translatorCache.clear();
  translationResultCache.clear();
}
