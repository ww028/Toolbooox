export const CLOSE_SIDE_PANEL_MESSAGE_TYPE = "toolbooox.sidePanel.close";
export const OPEN_AI_ASSISTANT_SIDE_PANEL_MESSAGE_TYPE =
  "toolbooox.sidePanel.openAiAssistant";

export type CloseSidePanelMessage = {
  readonly type: typeof CLOSE_SIDE_PANEL_MESSAGE_TYPE;
};

export type OpenAiAssistantSidePanelMessage = {
  readonly type: typeof OPEN_AI_ASSISTANT_SIDE_PANEL_MESSAGE_TYPE;
};

export function isCloseSidePanelMessage(value: unknown): value is CloseSidePanelMessage {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as Partial<CloseSidePanelMessage>).type === CLOSE_SIDE_PANEL_MESSAGE_TYPE
  );
}

export function isOpenAiAssistantSidePanelMessage(
  value: unknown
): value is OpenAiAssistantSidePanelMessage {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as Partial<OpenAiAssistantSidePanelMessage>).type ===
      OPEN_AI_ASSISTANT_SIDE_PANEL_MESSAGE_TYPE
  );
}
