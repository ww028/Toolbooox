import {
  doesRequestMatchCookieCaptureUrl,
  getCookieCaptureConfigs,
  getCookieHeaderFromRequestHeaders,
  type CookieCaptureConfig,
  saveCapturedCookieHeader
} from "../shared/chrome/cookies";
import {
  saveAiAssistantContextPrompt,
  type AiAssistantContextPrompt
} from "../shared/aiAssistant/contextPrompt";
import { OPEN_AI_ASSISTANT_SIDE_PANEL_MESSAGE_TYPE } from "../shared/sidePanel/messages";
import { saveSidePanelTool } from "../shared/sidePanel/tools";

const COOKIE_CAPTURE_CONFIGS_KEY = "toolbooox.cookieViewer.configs";
const AI_ASSISTANT_CONTEXT_MENU_ROOT_ID = "toolbooox.aiAssistant.selection";
const AI_ASSISTANT_CONTEXT_MENU_ID_PREFIX = `${AI_ASSISTANT_CONTEXT_MENU_ROOT_ID}.`;
const CONTEXT_SELECTION_MAX_LENGTH = 12_000;

type AiAssistantContextMenuAction = "summarize" | "translate" | "explain" | "rewrite";

const AI_ASSISTANT_CONTEXT_MENU_ACTIONS: Array<{
  readonly action: AiAssistantContextMenuAction;
  readonly titleMessageName: string;
  readonly fallbackTitle: string;
}> = [
  {
    action: "summarize",
    titleMessageName: "aiContextMenuSummarize",
    fallbackTitle: "摘要"
  },
  {
    action: "translate",
    titleMessageName: "aiContextMenuTranslate",
    fallbackTitle: "翻译"
  },
  {
    action: "explain",
    titleMessageName: "aiContextMenuExplain",
    fallbackTitle: "解释"
  },
  {
    action: "rewrite",
    titleMessageName: "aiContextMenuRewrite",
    fallbackTitle: "改写"
  }
];

let cachedConfigs: CookieCaptureConfig[] = [];

function getI18nMessage(messageName: string, fallback: string): string {
  return chrome.i18n.getMessage(messageName) || fallback;
}

function createContextMenu(createProperties: chrome.contextMenus.CreateProperties): Promise<void> {
  return new Promise((resolve) => {
    chrome.contextMenus.create(createProperties, () => {
      resolve();
    });
  });
}

function removeAllContextMenus(): Promise<void> {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => resolve());
  });
}

async function registerAiAssistantContextMenus(): Promise<void> {
  if (!chrome.contextMenus) {
    return;
  }

  await removeAllContextMenus();
  await createContextMenu({
    id: AI_ASSISTANT_CONTEXT_MENU_ROOT_ID,
    title: getI18nMessage("aiContextMenuRoot", "用 AI 助手处理选中文本"),
    contexts: ["selection"]
  });

  await Promise.all(
    AI_ASSISTANT_CONTEXT_MENU_ACTIONS.map(({ action, titleMessageName, fallbackTitle }) =>
      createContextMenu({
        id: `${AI_ASSISTANT_CONTEXT_MENU_ID_PREFIX}${action}`,
        parentId: AI_ASSISTANT_CONTEXT_MENU_ROOT_ID,
        title: getI18nMessage(titleMessageName, fallbackTitle),
        contexts: ["selection"]
      })
    )
  );
}

function normalizeContextMenuSelection(selectionText: string): string {
  const normalizedSelection = selectionText.trim();

  if (normalizedSelection.length <= CONTEXT_SELECTION_MAX_LENGTH) {
    return normalizedSelection;
  }

  return `${normalizedSelection.slice(
    0,
    CONTEXT_SELECTION_MAX_LENGTH
  )}\n\n[选中文本过长，已截断后续内容。]`;
}

function containsChineseText(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function createAiAssistantContextPrompt(
  action: AiAssistantContextMenuAction,
  selectionText: string
): AiAssistantContextPrompt {
  const normalizedSelection = normalizeContextMenuSelection(selectionText);

  if (action === "summarize") {
    return {
      input: `摘要：\n\n${normalizedSelection}`,
      prompt: `请总结以下选中文本，先给出核心结论，再列出关键要点：\n\n${normalizedSelection}`
    };
  }

  if (action === "translate") {
    const targetLanguage = containsChineseText(normalizedSelection) ? "英文" : "中文";
    const targetLanguageInPrompt = containsChineseText(normalizedSelection) ? "English" : "Chinese";

    return {
      input: `翻译成${targetLanguage}：\n\n${normalizedSelection}`,
      prompt: [
        "TRANSLATION TASK. Return the translation only.",
        `Target language: ${targetLanguageInPrompt}.`,
        "Do not explain. Do not summarize. Do not copy the source text.",
        "If the source text is Chinese, translate it into natural, accurate English.",
        "If the source text is not Chinese, translate it into natural Chinese.",
        "For Chinese business terms, translate “业务办理” as service handling / service processing according to context, and “试单” as trial order / test order according to context.",
        `Your final answer must be in ${targetLanguageInPrompt}, not in the source language.`,
        "",
        "Source text:",
        normalizedSelection
      ].join("\n")
    };
  }

  if (action === "explain") {
    return {
      input: `解释：\n\n${normalizedSelection}`,
      prompt: `请解释以下选中文本的含义，用通俗语言说明背景、关键概念和可能的上下文：\n\n${normalizedSelection}`
    };
  }

  return {
    input: `改写：\n\n${normalizedSelection}`,
    prompt: `请改写以下选中文本，使表达更清晰、自然、专业。保留原意，不新增事实：\n\n${normalizedSelection}`
  };
}

function parseAiAssistantContextMenuAction(
  menuItemId: string | number
): AiAssistantContextMenuAction | null {
  if (typeof menuItemId !== "string" || !menuItemId.startsWith(AI_ASSISTANT_CONTEXT_MENU_ID_PREFIX)) {
    return null;
  }

  const action = menuItemId.slice(AI_ASSISTANT_CONTEXT_MENU_ID_PREFIX.length);

  return AI_ASSISTANT_CONTEXT_MENU_ACTIONS.some((menuAction) => menuAction.action === action)
    ? (action as AiAssistantContextMenuAction)
    : null;
}

function notifyAiAssistantSidePanelContextPromptReady(): void {
  void chrome.runtime
    .sendMessage({
      type: OPEN_AI_ASSISTANT_SIDE_PANEL_MESSAGE_TYPE
    })
    .catch(() => undefined);
}

function handleAiAssistantContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): void {
  const action = parseAiAssistantContextMenuAction(info.menuItemId);
  const selectionText = info.selectionText?.trim();

  if (!action || !selectionText) {
    return;
  }

  const saveContextPromptPromise = saveAiAssistantContextPrompt(
    createAiAssistantContextPrompt(action, selectionText)
  );
  const saveSidePanelToolPromise = saveSidePanelTool("aiAssistant").catch(() => undefined);

  if (chrome.sidePanel?.open && typeof tab?.id === "number") {
    void chrome.sidePanel
      .open({ tabId: tab.id })
      .then(() => Promise.all([saveContextPromptPromise, saveSidePanelToolPromise]))
      .then(() => {
        notifyAiAssistantSidePanelContextPromptReady();
      })
      .catch(() => undefined);
    return;
  }

  void Promise.all([saveContextPromptPromise, saveSidePanelToolPromise])
    .then(() =>
      chrome.tabs.create({
        url: chrome.runtime.getURL("sidepanel.html")
      })
    )
    .catch(() => undefined);
}

chrome.runtime.onInstalled.addListener(() => {
  void registerAiAssistantContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  void registerAiAssistantContextMenus();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleAiAssistantContextMenuClick(info, tab);
});

void getCookieCaptureConfigs().then((configs) => {
  cachedConfigs = configs;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  const configsChange = changes[COOKIE_CAPTURE_CONFIGS_KEY];

  if (Array.isArray(configsChange?.newValue)) {
    cachedConfigs = configsChange.newValue.filter(
      (config): config is CookieCaptureConfig =>
        typeof config?.pageHostname === "string" && typeof config?.requestUrl === "string"
    );
  }
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    void (async () => {
      const configs = cachedConfigs.length > 0 ? cachedConfigs : await getCookieCaptureConfigs();
      const matchedConfig = configs.find(
        (config) => doesRequestMatchCookieCaptureUrl(details.url, config.requestUrl)
      );

      if (!matchedConfig) {
        return;
      }

      cachedConfigs = configs;

      await saveCapturedCookieHeader({
        pageHostname: matchedConfig.pageHostname,
        requestUrl: matchedConfig.requestUrl,
        matchedUrl: details.url,
        method: details.method,
        cookieHeader: getCookieHeaderFromRequestHeaders(details.requestHeaders),
        capturedAt: new Date().toISOString()
      });
    })();
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);
