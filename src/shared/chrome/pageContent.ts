import { getActiveTabInfo } from "./tabs";

const PAGE_CONTENT_MAX_LENGTH = 12_000;

export type ActivePageContent = {
  readonly title: string;
  readonly url: string;
  readonly text: string;
};

function normalizePageText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncatePageText(value: string): string {
  if (value.length <= PAGE_CONTENT_MAX_LENGTH) {
    return value;
  }

  return `${value.slice(0, PAGE_CONTENT_MAX_LENGTH)}\n\n[页面内容较长，已截断后续内容。]`;
}

export function shouldUseActivePageContent(prompt: string): boolean {
  const normalizedPrompt = prompt.toLowerCase();

  return (
    /当前.*(页面|网页|网站|内容|文章|tab)/.test(prompt) ||
    /(这个|这篇|本页).*(页面|网页|网站|内容|文章)/.test(prompt) ||
    normalizedPrompt.includes("current page") ||
    normalizedPrompt.includes("this page") ||
    normalizedPrompt.includes("webpage")
  );
}

export async function getActivePageContent(): Promise<ActivePageContent | null> {
  if (typeof chrome === "undefined" || !chrome.scripting?.executeScript) {
    return null;
  }

  const activeTab = await getActiveTabInfo();

  if (!activeTab) {
    return null;
  }

  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: () => ({
      title: document.title,
      url: window.location.href,
      text: document.body?.innerText ?? ""
    })
  });

  if (!result || typeof result.text !== "string") {
    return null;
  }

  const text = truncatePageText(normalizePageText(result.text));

  if (!text) {
    return null;
  }

  return {
    title: typeof result.title === "string" && result.title.trim() ? result.title : activeTab.title,
    url: typeof result.url === "string" && result.url.trim() ? result.url : activeTab.url,
    text
  };
}

export function createActivePageContextPrompt(
  userPrompt: string,
  pageContent: ActivePageContent
): string {
  return [
    "请基于当前浏览器页面内容回答用户问题。",
    "如果页面内容中没有足够信息，请明确说明缺口，不要编造。",
    "",
    "当前页面标题：",
    pageContent.title || "无标题",
    "",
    "当前页面 URL：",
    pageContent.url,
    "",
    "当前页面正文：",
    pageContent.text,
    "",
    "用户问题：",
    userPrompt
  ].join("\n");
}
