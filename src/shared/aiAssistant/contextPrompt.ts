const AI_ASSISTANT_CONTEXT_PROMPT_STORAGE_KEY = "toolbooox.aiAssistant.contextPrompt";

export type AiAssistantContextPrompt = {
  readonly input: string;
  readonly prompt: string;
};

function getChromeStorageLocal(): chrome.storage.LocalStorageArea | null {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return null;
  }

  return chrome.storage.local;
}

export async function saveAiAssistantContextPrompt(
  contextPrompt: AiAssistantContextPrompt
): Promise<void> {
  const storage = getChromeStorageLocal();

  if (!storage) {
    return;
  }

  await storage.set({
    [AI_ASSISTANT_CONTEXT_PROMPT_STORAGE_KEY]: contextPrompt
  });
}

function normalizeContextPrompt(value: unknown): AiAssistantContextPrompt | null {
  if (typeof value === "string") {
    return {
      input: value,
      prompt: value
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const contextPrompt = value as Partial<AiAssistantContextPrompt>;

  if (typeof contextPrompt.input !== "string" || typeof contextPrompt.prompt !== "string") {
    return null;
  }

  return {
    input: contextPrompt.input,
    prompt: contextPrompt.prompt
  };
}

export async function consumeAiAssistantContextPrompt(): Promise<AiAssistantContextPrompt | null> {
  const storage = getChromeStorageLocal();

  if (!storage) {
    return null;
  }

  const storedValue = await storage.get(AI_ASSISTANT_CONTEXT_PROMPT_STORAGE_KEY);
  await storage.remove(AI_ASSISTANT_CONTEXT_PROMPT_STORAGE_KEY);

  return normalizeContextPrompt(storedValue[AI_ASSISTANT_CONTEXT_PROMPT_STORAGE_KEY]);
}
