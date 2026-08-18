import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  prewarmChromeTranslator,
  resetChromeTranslatorCaches,
  translateWithChromeTranslator
} from "./chromeTranslator";

function createTranslatorMock() {
  const translate = vi.fn(async (text: string) => `translated:${text}`);
  const destroy = vi.fn();
  const availability = vi.fn(async () => "available");
  const create = vi.fn(async () => ({
    translate,
    destroy
  }));

  return {
    availability,
    create,
    translate,
    destroy
  };
}

describe("chrome translator", () => {
  beforeEach(() => {
    resetChromeTranslatorCaches();
    vi.restoreAllMocks();
  });

  it("reuses a warmed translator for the same language pair", async () => {
    const translatorMock = createTranslatorMock();
    vi.stubGlobal("Translator", {
      availability: translatorMock.availability,
      create: translatorMock.create
    });

    await expect(
      prewarmChromeTranslator({
        sourceLanguage: "en",
        targetLanguage: "zh-Hans"
      })
    ).resolves.toBe(true);

    await expect(
      translateWithChromeTranslator({
        sourceLanguage: "en",
        targetLanguage: "zh-Hans",
        text: "hello"
      })
    ).resolves.toBe("translated:hello");

    expect(translatorMock.availability).toHaveBeenCalledTimes(1);
    expect(translatorMock.create).toHaveBeenCalledTimes(1);
    expect(translatorMock.destroy).not.toHaveBeenCalled();
  });

  it("returns repeated translations from the in-memory result cache", async () => {
    const translatorMock = createTranslatorMock();
    vi.stubGlobal("Translator", {
      availability: translatorMock.availability,
      create: translatorMock.create
    });

    const options = {
      sourceLanguage: "en" as const,
      targetLanguage: "zh-Hans" as const,
      text: "same text"
    };

    await expect(translateWithChromeTranslator(options)).resolves.toBe("translated:same text");
    await expect(translateWithChromeTranslator(options)).resolves.toBe("translated:same text");

    expect(translatorMock.availability).toHaveBeenCalledTimes(1);
    expect(translatorMock.create).toHaveBeenCalledTimes(1);
    expect(translatorMock.translate).toHaveBeenCalledTimes(1);
  });

  it("reports unsupported browsers without throwing during prewarm", async () => {
    vi.stubGlobal("Translator", undefined);

    await expect(
      prewarmChromeTranslator({
        sourceLanguage: "en",
        targetLanguage: "zh-Hans"
      })
    ).resolves.toBe(false);
    await expect(
      translateWithChromeTranslator({
        sourceLanguage: "en",
        targetLanguage: "zh-Hans",
        text: "hello"
      })
    ).rejects.toThrow("TRANSLATOR_UNSUPPORTED");
  });
});
