import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  askChromeLanguageModel,
  askChromeLanguageModelStreaming,
  prewarmChromeLanguageModel,
  resetChromeLanguageModelSession
} from "./chromeLanguageModel";

function createLanguageModelMock() {
  const prompt = vi.fn(async (input: string) => `answer:${input}`);
  const destroy = vi.fn();
  const availability = vi.fn(async () => "available");
  const create = vi.fn(async () => ({
    prompt,
    destroy
  }));

  return {
    availability,
    create,
    prompt,
    destroy
  };
}

describe("chrome language model", () => {
  beforeEach(() => {
    resetChromeLanguageModelSession();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reuses a warmed language model session", async () => {
    const languageModelMock = createLanguageModelMock();
    vi.stubGlobal("LanguageModel", {
      availability: languageModelMock.availability,
      create: languageModelMock.create
    });

    await expect(prewarmChromeLanguageModel()).resolves.toBe(true);
    await expect(askChromeLanguageModel("hello")).resolves.toBe("answer:hello");

    expect(languageModelMock.availability).toHaveBeenCalledTimes(1);
    expect(languageModelMock.create).toHaveBeenCalledTimes(1);
    expect(languageModelMock.prompt).toHaveBeenCalledTimes(2);
  });

  it("falls back to ai.languageModel", async () => {
    const languageModelMock = createLanguageModelMock();
    vi.stubGlobal("LanguageModel", undefined);
    vi.stubGlobal("ai", {
      languageModel: {
        availability: languageModelMock.availability,
        create: languageModelMock.create
      }
    });

    await expect(askChromeLanguageModel("local")).resolves.toBe("answer:local");

    expect(languageModelMock.availability).toHaveBeenCalledTimes(1);
    expect(languageModelMock.create).toHaveBeenCalledTimes(1);
  });

  it("reports unsupported browsers without throwing during prewarm", async () => {
    vi.stubGlobal("LanguageModel", undefined);
    vi.stubGlobal("ai", undefined);

    await expect(prewarmChromeLanguageModel()).resolves.toBe(false);
    await expect(askChromeLanguageModel("hello")).rejects.toThrow(
      "LANGUAGE_MODEL_UNSUPPORTED"
    );
  });

  it("streams partial model responses", async () => {
    async function* streamResponse() {
      yield "hel";
      yield "lo";
    }

    vi.stubGlobal("LanguageModel", {
      availability: vi.fn(async () => "available"),
      create: vi.fn(async () => ({
        prompt: vi.fn(async (input: string) => `answer:${input}`),
        promptStreaming: vi.fn(() => streamResponse())
      }))
    });

    const chunks: string[] = [];
    await expect(
      askChromeLanguageModelStreaming("hello", (chunk) => {
        chunks.push(chunk);
      })
    ).resolves.toBe("hello");

    expect(chunks).toEqual(["hel", "lo"]);
  });

  it("times out when the model does not respond", async () => {
    vi.useFakeTimers();
    const destroy = vi.fn();
    vi.stubGlobal("LanguageModel", {
      availability: vi.fn(async () => "available"),
      create: vi.fn(async () => ({
        prompt: vi.fn(() => new Promise<string>(() => undefined)),
        destroy
      }))
    });

    const pendingAnswer = askChromeLanguageModel("hello");
    const timeoutAssertion = expect(pendingAnswer).rejects.toThrow("LANGUAGE_MODEL_TIMEOUT");
    await vi.advanceTimersByTimeAsync(8_000);

    await timeoutAssertion;
    expect(destroy).not.toHaveBeenCalled();
  });
});
