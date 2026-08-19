import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  askChromeLanguageModel,
  askChromeLanguageModelStreaming,
  createAiAssistantPrompt,
  prewarmChromeLanguageModel,
  resetChromeLanguageModelSession,
  summarizeAiAssistantConversationTurn
} from "./chromeLanguageModel";

function createLanguageModelMock() {
  const prompt = vi.fn(async (input: string) => `answer:${input}`);
  const destroy = vi.fn();
  const availability = vi.fn(async () => "available");
  const params = vi.fn(async () => ({
    maxTemperature: 2,
    maxTopK: 128
  }));
  const create = vi.fn(async () => ({
    prompt,
    destroy
  }));

  return {
    availability,
    params,
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
      params: languageModelMock.params,
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
        outputLanguage: "en",
        temperature: 0.4,
        topK: 32
      })
    );
  });

  it("falls back to ai.languageModel", async () => {
    const languageModelMock = createLanguageModelMock();
    vi.stubGlobal("LanguageModel", undefined);
    vi.stubGlobal("ai", {
      languageModel: {
        availability: languageModelMock.availability,
        params: languageModelMock.params,
        create: languageModelMock.create
      }
    });

    await expect(askChromeLanguageModel("local")).resolves.toContain("当前用户请求：\nlocal");

    expect(languageModelMock.availability).toHaveBeenCalledTimes(1);
    expect(languageModelMock.create).toHaveBeenCalledTimes(1);
  });

  it("clamps sampling options to the current browser limits", async () => {
    const create = vi.fn(async () => ({
      prompt: vi.fn(async (input: string) => `answer:${input}`)
    }));

    vi.stubGlobal("LanguageModel", {
      availability: vi.fn(async () => "available"),
      params: vi.fn(async () => ({
        maxTemperature: 0.2,
        maxTopK: 8
      })),
      create
    });

    await expect(askChromeLanguageModel("hello")).resolves.toContain(
      "当前用户请求：\nhello"
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.2,
        topK: 8
      })
    );
  });

  it("builds an optimized prompt with task rules, examples, and recent context", () => {
    const prompt = createAiAssistantPrompt("继续总结", {
      conversationSummary: "用户正在讨论 AI 助手上下文管理。",
      messages: [
        { role: "user", content: "第一轮问题" },
        { role: "assistant", content: "第一轮回答" }
      ]
    });

    expect(prompt).toContain("默认回答风格：");
    expect(prompt).toContain("像自然聊天一样回答");
    expect(prompt).toContain("段落之间保留空行");
    expect(prompt).toContain("直接输出目标语言译文");
    expect(prompt).toContain("未指定目标语言时，中文翻译成英文，非中文翻译成中文");
    expect(prompt).toContain("目标语言不是中文，不要受默认中文回复规则影响");
    expect(prompt).toContain("「我」「我的」都指用户本人");
    expect(prompt).toContain("用「你」「你的」转述这些事实");
    expect(prompt).toContain("涉及用户宠物时，统一称为「你的宠物」");
    expect(prompt).toContain("你的宠物薯条是银渐层");
    expect(prompt).toContain("只能根据上下文中的直接证据回答");
    expect(prompt).toContain("相近但不同的事实不能当作肯定答案");
    expect(prompt).toContain("不要在最终回答里说“根据片段”");
    expect(prompt).toContain("我不知道呀，我这里没有这方面的信息");
    expect(prompt).toContain("复杂任务工作流：");
    expect(prompt).toContain("先把任务拆成 2-4 个小步骤");
    expect(prompt).toContain("拆解后直接执行这些步骤");
    expect(prompt).toContain("示例（只学习风格");
    expect(prompt).toContain("Step 1: 判断任务是简单请求还是复杂请求");
    expect(prompt).toContain("本次会话压缩记忆：\n用户正在讨论 AI 助手上下文管理。");
    expect(prompt).toContain("最近短期对话上下文：");
    expect(prompt).toContain("用户: 第一轮问题");
    expect(prompt).toContain("助手: 第一轮回答");
    expect(prompt).toContain("当前用户请求：\n继续总结");
  });

  it("summarizes conversation memory with a cloned session when available", async () => {
    const basePrompt = vi.fn(async (input: string) => `base:${input}`);
    const clonedDestroy = vi.fn();
    const clonedPrompt = vi.fn(async () => "用户正在调试 AI 助手，并关注上下文摘要。");
    const clone = vi.fn(async () => ({
      prompt: clonedPrompt,
      destroy: clonedDestroy
    }));

    vi.stubGlobal("LanguageModel", {
      availability: vi.fn(async () => "available"),
      create: vi.fn(async () => ({
        prompt: basePrompt,
        clone
      }))
    });

    await expect(
      summarizeAiAssistantConversationTurn({
        previousSummary: "用户在优化 AI 助手。",
        userPrompt: "继续处理上下文",
        assistantAnswer: "已经加入滚动摘要。"
      })
    ).resolves.toBe("用户正在调试 AI 助手，并关注上下文摘要。");

    expect(clone).toHaveBeenCalledTimes(1);
    expect(basePrompt).not.toHaveBeenCalled();
    expect(clonedPrompt).toHaveBeenCalledWith(expect.stringContaining("新的压缩记忆："));
    expect(clonedDestroy).toHaveBeenCalledTimes(1);
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
    await vi.advanceTimersByTimeAsync(20_000);

    await timeoutAssertion;
    expect(destroy).not.toHaveBeenCalled();
  });
});
