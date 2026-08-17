import {
  doesRequestMatchCookieCaptureUrl,
  getCookieCaptureConfigs,
  getCookieHeaderFromRequestHeaders,
  type CookieCaptureConfig,
  saveCapturedCookieHeader
} from "../shared/chrome/cookies";

const COOKIE_CAPTURE_CONFIGS_KEY = "toolbooox.cookieViewer.configs";

let cachedConfigs: CookieCaptureConfig[] = [];

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
