import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  askChromeLanguageModel,
  askChromeLanguageModelStreaming,
  createAiAssistantPrompt,
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
    await expect(askChromeLanguageModel("hello")).resolves.toContain("当前用户请求：\nhello");

    expect(languageModelMock.availability).toHaveBeenCalledTimes(1);
    expect(languageModelMock.availability).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        outputLanguage: "en"
      })
    );
    expect(languageModelMock.create).toHaveBeenCalledTimes(1);
    expect(languageModelMock.prompt).toHaveBeenCalledTimes(2);
    expect(languageModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("你是我的个人浏览器助手"),
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        outputLanguage: "en"
      })
    );
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

    await expect(askChromeLanguageModel("local")).resolves.toContain("当前用户请求：\nlocal");

    expect(languageModelMock.availability).toHaveBeenCalledTimes(1);
    expect(languageModelMock.create).toHaveBeenCalledTimes(1);
  });

  it("builds an optimized prompt with task rules, examples, and recent context", () => {
    const prompt = createAiAssistantPrompt("继续总结", {
      messages: [
        { role: "user", content: "第一轮问题" },
        { role: "assistant", content: "第一轮回答" }
      ]
    });

    expect(prompt).toContain("默认回答风格：");
    expect(prompt).toContain("像自然聊天一样回答");
    expect(prompt).toContain("段落之间保留空行");
    expect(prompt).toContain("示例（只学习风格");
    expect(prompt).toContain("Step 1");
    expect(prompt).toContain("用户: 第一轮问题");
    expect(prompt).toContain("助手: 第一轮回答");
    expect(prompt).toContain("当前用户请求：\n继续总结");
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
