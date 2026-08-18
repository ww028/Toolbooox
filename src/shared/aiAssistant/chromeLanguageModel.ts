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

type ChromeLanguageModelConstructor = {
  availability?: () => Promise<LanguageModelAvailability>;
  capabilities?: () => Promise<{
    readonly available?: LanguageModelAvailability;
  }>;
  create(options?: {
    readonly systemPrompt?: string;
    readonly monitor?: (monitorTarget: EventTarget) => void;
  }): Promise<ChromeLanguageModelSession>;
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
  "You are a concise, practical AI assistant running locally in a browser extension. Answer clearly and directly.";
const LANGUAGE_MODEL_CREATE_TIMEOUT_MS = 120_000;
const LANGUAGE_MODEL_PROMPT_TIMEOUT_MS = 8_000;
const LANGUAGE_MODEL_WARMUP_TIMEOUT_MS = 30_000;
const LANGUAGE_MODEL_WARMUP_PROMPT = "Reply with OK.";

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

async function ensureLanguageModelAvailable(
  languageModel: ChromeLanguageModelConstructor,
  onUpdate?: (update: LanguageModelInitializationUpdate) => void
): Promise<LanguageModelAvailability> {
  if (cachedAvailability) {
    return "available";
  }

  onUpdate?.({ phase: "checking" });
  const availability = languageModel.availability
    ? await languageModel.availability()
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

export async function askChromeLanguageModel(prompt: string): Promise<string> {
  const languageModel = getChromeLanguageModel();

  if (!languageModel) {
    throw new Error("LANGUAGE_MODEL_UNSUPPORTED");
  }

  await ensureLanguageModelAvailable(languageModel);
  const session = await getOrCreateLanguageModelSession(languageModel);

  return withTimeout(
    session.prompt(prompt),
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
  onChunk: (chunk: string) => void
): Promise<string> {
  const languageModel = getChromeLanguageModel();

  if (!languageModel) {
    throw new Error("LANGUAGE_MODEL_UNSUPPORTED");
  }

  await ensureLanguageModelAvailable(languageModel);
  const session = await getOrCreateLanguageModelSession(languageModel);

  if (!session.promptStreaming) {
    const answer = await askChromeLanguageModel(prompt);
    onChunk(answer);
    return answer;
  }

  return withTimeout(
    readLanguageModelStream(session.promptStreaming(prompt), onChunk),
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
