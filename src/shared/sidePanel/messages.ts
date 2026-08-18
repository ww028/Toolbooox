export const CLOSE_SIDE_PANEL_MESSAGE_TYPE = "toolbooox.sidePanel.close";

export type CloseSidePanelMessage = {
  readonly type: typeof CLOSE_SIDE_PANEL_MESSAGE_TYPE;
};

export function isCloseSidePanelMessage(value: unknown): value is CloseSidePanelMessage {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as Partial<CloseSidePanelMessage>).type === CLOSE_SIDE_PANEL_MESSAGE_TYPE
  );
}
