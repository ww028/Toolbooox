import {
  getIndexedDbValue,
  setIndexedDbValue
} from "../storage/indexedDbKeyValue";

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
  return normalizeTextCompareState(await getIndexedDbValue(TEXT_COMPARE_STATE_STORAGE_KEY));
}

export async function saveTextCompareState(state: TextCompareState): Promise<void> {
  await setIndexedDbValue(TEXT_COMPARE_STATE_STORAGE_KEY, state);
}
