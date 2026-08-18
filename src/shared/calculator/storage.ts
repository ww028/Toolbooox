export type CalculatorHistoryItem = {
  readonly id: string;
  readonly expression: string;
  readonly result: string;
  readonly resultDescription: string;
  readonly createdAt: string;
};

export type CalculatorState = {
  readonly expression: string;
  readonly result: string;
  readonly resultDescription: string;
  readonly history: readonly CalculatorHistoryItem[];
};

const CALCULATOR_STATE_STORAGE_KEY = "toolbooox.calculator.state";
const CALCULATOR_HISTORY_LIMIT = 10;
const emptyCalculatorState: CalculatorState = {
  expression: "",
  result: "",
  resultDescription: "",
  history: []
};

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function isCalculatorHistoryItem(value: unknown): value is CalculatorHistoryItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<CalculatorHistoryItem>;

  return (
    typeof item.id === "string" &&
    typeof item.expression === "string" &&
    typeof item.result === "string" &&
    typeof item.resultDescription === "string" &&
    typeof item.createdAt === "string"
  );
}

function shouldKeepResultDescription(result: string): boolean {
  const integerPart = result.replace(/,/g, "").replace(/^-/, "").split(".")[0] ?? "";
  return integerPart.replace(/^0+/, "").length > 3;
}

function normalizeResultDescription(result: string, resultDescription: unknown): string {
  return typeof resultDescription === "string" && shouldKeepResultDescription(result)
    ? resultDescription
    : "";
}

function normalizeCalculatorHistoryItem(item: CalculatorHistoryItem): CalculatorHistoryItem {
  return {
    ...item,
    resultDescription: normalizeResultDescription(item.result, item.resultDescription)
  };
}

function normalizeCalculatorState(value: unknown): CalculatorState {
  if (!value || typeof value !== "object") {
    return emptyCalculatorState;
  }

  const state = value as Partial<CalculatorState>;

  const result = typeof state.result === "string" ? state.result : "";

  return {
    expression: typeof state.expression === "string" ? state.expression : "",
    result,
    resultDescription: normalizeResultDescription(result, state.resultDescription),
    history: Array.isArray(state.history)
      ? state.history
          .filter(isCalculatorHistoryItem)
          .map(normalizeCalculatorHistoryItem)
          .slice(0, CALCULATOR_HISTORY_LIMIT)
      : []
  };
}

export async function getSavedCalculatorState(): Promise<CalculatorState> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(CALCULATOR_STATE_STORAGE_KEY);
    return normalizeCalculatorState(result[CALCULATOR_STATE_STORAGE_KEY]);
  }

  const rawState = window.localStorage.getItem(CALCULATOR_STATE_STORAGE_KEY);

  if (!rawState) {
    return emptyCalculatorState;
  }

  try {
    return normalizeCalculatorState(JSON.parse(rawState));
  } catch {
    return emptyCalculatorState;
  }
}

export async function saveCalculatorState(state: Partial<CalculatorState>): Promise<CalculatorState> {
  const currentState = await getSavedCalculatorState();
  const nextState = normalizeCalculatorState({
    ...currentState,
    ...state
  });

  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [CALCULATOR_STATE_STORAGE_KEY]: nextState });
    return nextState;
  }

  window.localStorage.setItem(CALCULATOR_STATE_STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export async function appendCalculatorHistoryItem(
  item: Omit<CalculatorHistoryItem, "id" | "createdAt">
): Promise<CalculatorState> {
  const currentState = await getSavedCalculatorState();
  const nextHistoryItem: CalculatorHistoryItem = {
    ...item,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString()
  };

  return saveCalculatorState({
    ...currentState,
    expression: item.expression,
    result: item.result,
    resultDescription: item.resultDescription,
    history: [nextHistoryItem, ...currentState.history].slice(0, CALCULATOR_HISTORY_LIMIT)
  });
}
