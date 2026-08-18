export type TextCompareState = {
  readonly leftText: string;
  readonly rightText: string;
  readonly hasCompared: boolean;
};

export const emptyTextCompareState: TextCompareState = {
  leftText: "",
  rightText: "",
  hasCompared: false
};

const TEXT_COMPARE_STATE_STORAGE_KEY = "toolbooox.textCompareState";

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function normalizeTextCompareState(value: unknown): TextCompareState {
  if (!value || typeof value !== "object") {
    return emptyTextCompareState;
  }

  const savedState = value as Partial<TextCompareState>;

  return {
    leftText: typeof savedState.leftText === "string" ? savedState.leftText : "",
    rightText: typeof savedState.rightText === "string" ? savedState.rightText : "",
    hasCompared: savedState.hasCompared === true
  };
}

export async function getSavedTextCompareState(): Promise<TextCompareState> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(TEXT_COMPARE_STATE_STORAGE_KEY);
    return normalizeTextCompareState(result[TEXT_COMPARE_STATE_STORAGE_KEY]);
  }

  const rawState = window.localStorage.getItem(TEXT_COMPARE_STATE_STORAGE_KEY);

  if (!rawState) {
    return emptyTextCompareState;
  }

  try {
    return normalizeTextCompareState(JSON.parse(rawState));
  } catch {
    return emptyTextCompareState;
  }
}

export async function saveTextCompareState(state: TextCompareState): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [TEXT_COMPARE_STATE_STORAGE_KEY]: state });
    return;
  }

  window.localStorage.setItem(TEXT_COMPARE_STATE_STORAGE_KEY, JSON.stringify(state));
}
