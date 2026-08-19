type LanguageModelAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "readily"
  | "after-download"
  | "no";

type ChromeLanguageModelSession = {
  prompt(input: string, options?: { readonly signal?: AbortSignal }): Promise<string>;
  promptStreaming?: (
    input: string,
    options?: { readonly signal?: AbortSignal }
  ) => ReadableStream<string> | AsyncIterable<string>;
  destroy?: () => void;
};

type ChromeLanguageModelTextOptions = {
  readonly expectedOutputs?: readonly {
    readonly type: "text";
    readonly languages: readonly string[];
  }[];
  readonly outputLanguage?: string;
};

type ChromeLanguageModelConstructor = {
  availability?: (
    options?: ChromeLanguageModelTextOptions
  ) => Promise<LanguageModelAvailability>;
  capabilities?: () => Promise<{
    readonly available?: LanguageModelAvailability;
  }>;
  create(options?: ChromeLanguageModelTextOptions & {
    readonly systemPrompt?: string;
    readonly monitor?: (monitorTarget: EventTarget) => void;
  }): Promise<ChromeLanguageModelSession>;
};

export type AiAssistantPromptMessage = {
  readonly role: "user" | "assistant";
  readonly content: string;
};

export type AiAssistantPromptOptions = {
  readonly messages?: readonly AiAssistantPromptMessage[];
};

export type LanguageModelInitializationPhase =
  | "checking"
  | "downloading"
  | "creating"
  | "warming"
  | "ready";

export type LanguageModelInitializationUpdate = {
  readonly phase: LanguageModelInitializationPhase;
  readonly availability?: LanguageModelAvailability;
  readonly downloadProgress?: number;
};

const AI_ASSISTANT_SYSTEM_PROMPT =
  [
    "你是我的个人浏览器助手，名字叫「小助」。",
    "工作原则：",
    "1. 始终用中文回复，语气友好但专业。",
    "2. 默认像正常对话一样回答，不要套固定模板。",
    "3. 回答简洁，优先给结论；普通问题不超过 3 句话。",
    "4. 需要展开时使用自然段落、列表或表格；段落之间保留空行。",
    "5. 不确定的内容直接说「不确定」，不编造。",
    "6. 涉及代码、命令或结构化数据时，保持格式清晰。",
    "7. 翻译任务直接给出译文，除非用户要求解释。"
  ].join("\n");
const LANGUAGE_MODEL_CREATE_TIMEOUT_MS = 120_000;
const LANGUAGE_MODEL_PROMPT_TIMEOUT_MS = 8_000;
const LANGUAGE_MODEL_WARMUP_TIMEOUT_MS = 30_000;
const LANGUAGE_MODEL_WARMUP_PROMPT = "Reply with OK.";
const AI_ASSISTANT_CONTEXT_MESSAGE_LIMIT = 6;
const AI_ASSISTANT_CONTEXT_CONTENT_LIMIT = 1_200;
const LANGUAGE_MODEL_DECLARED_OUTPUT_LANGUAGE = "en";
const LANGUAGE_MODEL_TEXT_OPTIONS: ChromeLanguageModelTextOptions = {
  expectedOutputs: [{ type: "text", languages: [LANGUAGE_MODEL_DECLARED_OUTPUT_LANGUAGE] }],
  outputLanguage: LANGUAGE_MODEL_DECLARED_OUTPUT_LANGUAGE
};

let cachedAvailability: true | null = null;
let cachedSession: ChromeLanguageModelSession | null = null;
let cachedSessionPromise: Promise<ChromeLanguageModelSession> | null = null;
let sessionRequestId = 0;

function getChromeLanguageModel(): ChromeLanguageModelConstructor | null {
  const globalScope = globalThis as unknown as {
    LanguageModel?: ChromeLanguageModelConstructor;
    ai?: {
      languageModel?: ChromeLanguageModelConstructor;
    };
  };

  return globalScope.LanguageModel ?? globalScope.ai?.languageModel ?? null;
}

function isAvailabilityUsable(
  availability: LanguageModelAvailability | undefined
): availability is Exclude<LanguageModelAvailability, "unavailable" | "no"> {
  return (
    availability === "available" ||
    availability === "downloadable" ||
    availability === "downloading" ||
    availability === "readily" ||
    availability === "after-download"
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutErrorMessage: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timerId = globalThis.setTimeout(() => {
      reject(new Error(timeoutErrorMessage));
    }, timeoutMs);

    promise.then(
      (value) => {
        globalThis.clearTimeout(timerId);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timerId);
        reject(error);
      }
    );
  });
}

function truncatePromptContent(content: string, maxLength: number): string {
  const normalizedContent = content.replace(/\s+/g, " ").trim();

  if (normalizedContent.length <= maxLength) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, maxLength)}...`;
}

function formatPromptHistory(
  messages: readonly AiAssistantPromptMessage[] | undefined
): string {
  const historyMessages = messages
    ?.filter((message) => message.content.trim())
    .slice(-AI_ASSISTANT_CONTEXT_MESSAGE_LIMIT);

  if (!historyMessages?.length) {
    return "无";
  }

  return historyMessages
    .map((message) => {
      const roleLabel = message.role === "user" ? "用户" : "助手";

      return `${roleLabel}: ${truncatePromptContent(
        message.content,
        AI_ASSISTANT_CONTEXT_CONTENT_LIMIT
      )}`;
    })
    .join("\n");
}

export function createAiAssistantPrompt(
  prompt: string,
  options: AiAssistantPromptOptions = {}
): string {
  const normalizedPrompt = prompt.trim();

  return [
    "请处理用户的当前请求。",
    "",
    "默认回答风格：",
    "1. 像自然聊天一样回答，不要默认使用「核心观点」「关键数据」「行动建议」这类标签。",
    "2. 简单问题直接回答 1-3 句；需要换话题或展开时，用空行分成自然段，段落之间保留空行。",
    "3. 只有用户明确要求总结、对比、计划、清单或表格时，才使用列表、表格或小标题。",
    "4. 如果用户问「你是谁」这类身份问题，简短说明你是本地浏览器 AI 助手即可，不要写成报告。",
    "5. 如果用户要求翻译，直接输出译文，不加解释。",
    "6. 如果信息不足，明确说明缺口，并给出可执行的下一步。",
    "",
    "示例（只学习风格，不要复述示例）：",
    "用户：你是谁",
    "助手：我是 Toolbooox 里的本地 AI 助手，可以帮你做摘要、翻译、润色和轻量问答。\n\n我不联网，所以更适合处理你直接给我的文本。",
    "",
    "用户：帮我总结这篇文章",
    "助手：这篇文章主要在讲...\n\n值得关注的是...\n\n下一步可以...",
    "",
    "处理步骤（在内部完成，不要逐字展示推理过程）：",
    "Step 1: 判断用户任务类型与输出格式",
    "Step 2: 提取最近上下文中的相关信息",
    "Step 3: 生成简洁、准确、边界清晰的回答",
    "",
    "最近对话上下文：",
    formatPromptHistory(options.messages),
    "",
    "当前用户请求：",
    normalizedPrompt
  ].join("\n");
}

async function ensureLanguageModelAvailable(
  languageModel: ChromeLanguageModelConstructor,
  onUpdate?: (update: LanguageModelInitializationUpdate) => void
): Promise<LanguageModelAvailability> {
  if (cachedAvailability) {
    return "available";
  }

  onUpdate?.({ phase: "checking" });
  const availability = languageModel.availability
    ? await languageModel.availability(LANGUAGE_MODEL_TEXT_OPTIONS)
    : (await languageModel.capabilities?.())?.available;
  const verifiedAvailability = availability;

  if (!isAvailabilityUsable(verifiedAvailability)) {
    throw new Error("LANGUAGE_MODEL_UNAVAILABLE");
  }

  if (
    verifiedAvailability === "downloadable" ||
    verifiedAvailability === "downloading" ||
    verifiedAvailability === "after-download"
  ) {
    onUpdate?.({ phase: "downloading", availability: verifiedAvailability });
  }

  cachedAvailability = true;
  return verifiedAvailability;
}

async function getOrCreateLanguageModelSession(
  languageModel: ChromeLanguageModelConstructor,
  onUpdate?: (update: LanguageModelInitializationUpdate) => void
): Promise<ChromeLanguageModelSession> {
  if (cachedSession) {
    return cachedSession;
  }

  if (cachedSessionPromise) {
    return cachedSessionPromise;
  }

  const currentSessionRequestId = ++sessionRequestId;
  onUpdate?.({ phase: "creating" });
  cachedSessionPromise = withTimeout(
    languageModel.create({
      ...LANGUAGE_MODEL_TEXT_OPTIONS,
      systemPrompt: AI_ASSISTANT_SYSTEM_PROMPT,
      monitor(monitorTarget) {
        monitorTarget.addEventListener("downloadprogress", (event) => {
          const progressEvent = event as ProgressEvent;
          onUpdate?.({
            phase: "downloading",
            downloadProgress: progressEvent.loaded
          });
        });
      }
    }),
    LANGUAGE_MODEL_CREATE_TIMEOUT_MS,
    "LANGUAGE_MODEL_TIMEOUT"
  )
    .then((session) => {
      if (currentSessionRequestId === sessionRequestId) {
        cachedSession = session;
        cachedSessionPromise = null;
      }
      return session;
    })
    .catch((error: unknown) => {
      if (currentSessionRequestId === sessionRequestId) {
        cachedSessionPromise = null;
      }
      throw error;
    });

  return cachedSessionPromise;
}

async function warmupLanguageModelSession(
  session: ChromeLanguageModelSession,
  onUpdate?: (update: LanguageModelInitializationUpdate) => void
): Promise<void> {
  onUpdate?.({ phase: "warming" });
  await withTimeout(
    session.prompt(LANGUAGE_MODEL_WARMUP_PROMPT),
    LANGUAGE_MODEL_WARMUP_TIMEOUT_MS,
    "LANGUAGE_MODEL_TIMEOUT"
  );
  onUpdate?.({ phase: "ready" });
}

export async function initializeChromeLanguageModel(
  onUpdate?: (update: LanguageModelInitializationUpdate) => void
): Promise<void> {
  const languageModel = getChromeLanguageModel();

  if (!languageModel) {
    throw new Error("LANGUAGE_MODEL_UNSUPPORTED");
  }

  await ensureLanguageModelAvailable(languageModel, onUpdate);
  const session = await getOrCreateLanguageModelSession(languageModel, onUpdate);
  await warmupLanguageModelSession(session, onUpdate);
}

export async function prewarmChromeLanguageModel(): Promise<boolean> {
  try {
    await initializeChromeLanguageModel();
    return true;
  } catch {
    return false;
  }
}

export function isChromeLanguageModelInitialized(): boolean {
  return cachedSession !== null;
}

export async function askChromeLanguageModel(
  prompt: string,
  options: AiAssistantPromptOptions = {}
): Promise<string> {
  const languageModel = getChromeLanguageModel();

  if (!languageModel) {
    throw new Error("LANGUAGE_MODEL_UNSUPPORTED");
  }

  await ensureLanguageModelAvailable(languageModel);
  const session = await getOrCreateLanguageModelSession(languageModel);
  const optimizedPrompt = createAiAssistantPrompt(prompt, options);

  return withTimeout(
    session.prompt(optimizedPrompt),
    LANGUAGE_MODEL_PROMPT_TIMEOUT_MS,
    "LANGUAGE_MODEL_TIMEOUT"
  );
}

async function readLanguageModelStream(
  stream: ReadableStream<string> | AsyncIterable<string>,
  onChunk: (chunk: string) => void
): Promise<string> {
  let result = "";

  if (Symbol.asyncIterator in stream) {
    for await (const chunk of stream as AsyncIterable<string>) {
      result += chunk;
      onChunk(chunk);
    }

    return result;
  }

  const reader = (stream as ReadableStream<string>).getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        return result;
      }

      result += value;
      onChunk(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function askChromeLanguageModelStreaming(
  prompt: string,
  onChunk: (chunk: string) => void,
  options: AiAssistantPromptOptions = {}
): Promise<string> {
  const languageModel = getChromeLanguageModel();

  if (!languageModel) {
    throw new Error("LANGUAGE_MODEL_UNSUPPORTED");
  }

  await ensureLanguageModelAvailable(languageModel);
  const session = await getOrCreateLanguageModelSession(languageModel);

  if (!session.promptStreaming) {
    const answer = await askChromeLanguageModel(prompt, options);
    onChunk(answer);
    return answer;
  }
  const optimizedPrompt = createAiAssistantPrompt(prompt, options);

  return withTimeout(
    readLanguageModelStream(session.promptStreaming(optimizedPrompt), onChunk),
    LANGUAGE_MODEL_PROMPT_TIMEOUT_MS,
    "LANGUAGE_MODEL_TIMEOUT"
  );
}

export function resetChromeLanguageModelSession(): void {
  sessionRequestId += 1;
  cachedSession?.destroy?.();
  cachedAvailability = null;
  cachedSession = null;
  cachedSessionPromise = null;
}
