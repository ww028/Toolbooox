export type ActiveTabInfo = {
  readonly id: number;
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

  if (typeof tab?.id !== "number" || !tab.url) {
    return null;
  }

  return {
    id: tab.id,
    title: tab.title ?? "",
    url: tab.url
  };
}

export async function updateActiveTabUrl(tabId: number, url: string): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.tabs?.update) {
    window.location.href = url;
    return;
  }

  await chrome.tabs.update(tabId, { url });
}
