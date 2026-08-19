import {
  getIndexedDbValue,
  setIndexedDbValue
} from "../storage/indexedDbKeyValue";

export const ACTIVE_SIDE_PANEL_TOOL_STORAGE_KEY = "toolbooox.activeTool";

export type SidePanelToolKey = "aiAssistant" | "calculator" | "todoItems";

export function normalizeSidePanelToolKey(value: unknown): SidePanelToolKey {
  if (value === "aiAssistant" || value === "calculator") {
    return value;
  }

  return "todoItems";
}

export async function getSavedSidePanelTool(): Promise<SidePanelToolKey> {
  return normalizeSidePanelToolKey(await getIndexedDbValue(ACTIVE_SIDE_PANEL_TOOL_STORAGE_KEY));
}

export async function saveSidePanelTool(toolKey: SidePanelToolKey): Promise<void> {
  await setIndexedDbValue(ACTIVE_SIDE_PANEL_TOOL_STORAGE_KEY, toolKey);
}
