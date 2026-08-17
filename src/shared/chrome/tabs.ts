export type ActiveTabInfo = {
  readonly title: string;
  readonly url: string;
};

export async function getActiveTabInfo(): Promise<ActiveTabInfo | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return null;
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.url) {
    return null;
  }

  return {
    title: tab.title ?? "",
    url: tab.url
  };
}
