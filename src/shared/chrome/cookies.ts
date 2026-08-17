export type BrowserCookie = chrome.cookies.Cookie;

export type RequestCookiePair = {
  readonly name: string;
  readonly value: string;
};

export type CapturedCookieHeader = {
  readonly pageHostname: string;
  readonly requestUrl: string;
  readonly matchedUrl: string;
  readonly method: string;
  readonly cookieHeader: string;
  readonly capturedAt: string;
};

export type CookieCaptureConfig = {
  readonly pageHostname: string;
  readonly requestUrl: string;
};

const COOKIE_CAPTURE_REQUEST_URL_KEY = "toolbooox.cookieViewer.requestUrl";
const COOKIE_CAPTURE_CONFIGS_KEY = "toolbooox.cookieViewer.configs";
const CAPTURED_COOKIE_HEADER_KEY = "toolbooox.cookieViewer.capturedHeader";

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function hasChromeSessionStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.session);
}

function isCapturedCookieHeader(value: unknown): value is CapturedCookieHeader {
  if (!value || typeof value !== "object") {
    return false;
  }

  const header = value as Partial<CapturedCookieHeader>;
  return (
    typeof header.pageHostname === "string" &&
    typeof header.requestUrl === "string" &&
    typeof header.matchedUrl === "string" &&
    typeof header.method === "string" &&
    typeof header.cookieHeader === "string" &&
    typeof header.capturedAt === "string"
  );
}

function isCookieCaptureConfig(value: unknown): value is CookieCaptureConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as Partial<CookieCaptureConfig>;
  return typeof config.pageHostname === "string" && typeof config.requestUrl === "string";
}

function normalizePageHostname(pageHostname: string): string {
  return pageHostname.trim().toLowerCase().replace(/^www\./, "");
}

function normalizeHttpUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url.trim());

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    parsedUrl.hash = "";
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function normalizeCookieCaptureRequestUrl(url: string): string | null {
  return normalizeHttpUrl(url);
}

export function doesRequestMatchCookieCaptureUrl(requestUrl: string, savedRequestUrl: string): boolean {
  const normalizedRequestUrl = normalizeHttpUrl(requestUrl);
  const normalizedSavedRequestUrl = normalizeHttpUrl(savedRequestUrl);

  if (!normalizedRequestUrl || !normalizedSavedRequestUrl) {
    return false;
  }

  const request = new URL(normalizedRequestUrl);
  const savedRequest = new URL(normalizedSavedRequestUrl);

  return request.origin === savedRequest.origin && request.pathname === savedRequest.pathname;
}

export function doesPageMatchCookieCaptureConfig(pageUrl: string | undefined, pageHostname: string): boolean {
  if (!pageUrl || !pageHostname) {
    return false;
  }

  try {
    const currentPageHostname = new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, "");
    return currentPageHostname === normalizePageHostname(pageHostname);
  } catch {
    return false;
  }
}

export function getCookieHeaderFromRequestHeaders(
  headers?: chrome.webRequest.HttpHeader[]
): string {
  return headers?.find((header) => header.name.toLowerCase() === "cookie")?.value ?? "";
}

export function formatCookiePair(cookie: BrowserCookie): string {
  return `${cookie.name}=${cookie.value}`;
}

export function formatCookieHeader(cookies: readonly BrowserCookie[]): string {
  return cookies.map(formatCookiePair).join("; ");
}

export function parseCookieHeader(cookieHeader: string): RequestCookiePair[] {
  return cookieHeader
    .split(";")
    .map((cookiePair) => cookiePair.trim())
    .filter(Boolean)
    .map((cookiePair) => {
      const separatorIndex = cookiePair.indexOf("=");

      if (separatorIndex < 0) {
        return {
          name: cookiePair,
          value: ""
        };
      }

      return {
        name: cookiePair.slice(0, separatorIndex).trim(),
        value: cookiePair.slice(separatorIndex + 1).trim()
      };
    });
}

export async function getCookiesForUrl(url: string): Promise<BrowserCookie[]> {
  if (typeof chrome === "undefined" || !chrome.cookies?.getAll) {
    return [];
  }

  const cookies = await chrome.cookies.getAll({ url });

  return cookies.sort((leftCookie, rightCookie) => {
    const domainCompare = leftCookie.domain.localeCompare(rightCookie.domain);

    if (domainCompare !== 0) {
      return domainCompare;
    }

    const pathCompare = leftCookie.path.localeCompare(rightCookie.path);

    if (pathCompare !== 0) {
      return pathCompare;
    }

    return leftCookie.name.localeCompare(rightCookie.name);
  });
}

export async function getCookieCaptureConfigs(): Promise<CookieCaptureConfig[]> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(COOKIE_CAPTURE_CONFIGS_KEY);
    const configs = result[COOKIE_CAPTURE_CONFIGS_KEY];
    return Array.isArray(configs) ? configs.filter(isCookieCaptureConfig) : [];
  }

  const rawConfigs = window.localStorage.getItem(COOKIE_CAPTURE_CONFIGS_KEY);

  if (!rawConfigs) {
    return [];
  }

  try {
    const configs: unknown = JSON.parse(rawConfigs);
    return Array.isArray(configs) ? configs.filter(isCookieCaptureConfig) : [];
  } catch {
    return [];
  }
}

export async function getCookieCaptureRequestUrl(pageHostname: string): Promise<string> {
  const normalizedPageHostname = normalizePageHostname(pageHostname);

  if (!normalizedPageHostname) {
    return "";
  }

  const configs = await getCookieCaptureConfigs();
  const matchedConfig = configs.find(
    (config) => normalizePageHostname(config.pageHostname) === normalizedPageHostname
  );

  return matchedConfig?.requestUrl ?? "";
}

export async function saveCookieCaptureRequestUrl(
  url: string,
  pageHostname: string
): Promise<string> {
  const normalizedUrl = normalizeCookieCaptureRequestUrl(url);
  const normalizedPageHostname = normalizePageHostname(pageHostname);

  if (!normalizedUrl || !normalizedPageHostname) {
    throw new Error("INVALID_REQUEST_URL");
  }

  const configs = await getCookieCaptureConfigs();
  const nextConfig: CookieCaptureConfig = {
    pageHostname: normalizedPageHostname,
    requestUrl: normalizedUrl
  };
  const nextConfigs = configs.some(
    (config) => normalizePageHostname(config.pageHostname) === normalizedPageHostname
  )
    ? configs.map((config) =>
        normalizePageHostname(config.pageHostname) === normalizedPageHostname ? nextConfig : config
      )
    : [nextConfig, ...configs];

  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [COOKIE_CAPTURE_CONFIGS_KEY]: nextConfigs });
    await chrome.storage.local.remove(COOKIE_CAPTURE_REQUEST_URL_KEY);
    return normalizedUrl;
  }

  window.localStorage.setItem(COOKIE_CAPTURE_CONFIGS_KEY, JSON.stringify(nextConfigs));
  window.localStorage.removeItem(COOKIE_CAPTURE_REQUEST_URL_KEY);
  return normalizedUrl;
}

export async function getCapturedCookieHeader(): Promise<CapturedCookieHeader | null> {
  if (hasChromeSessionStorage()) {
    const result = await chrome.storage.session.get(CAPTURED_COOKIE_HEADER_KEY);
    const capturedHeader = result[CAPTURED_COOKIE_HEADER_KEY];
    return isCapturedCookieHeader(capturedHeader) ? capturedHeader : null;
  }

  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(CAPTURED_COOKIE_HEADER_KEY);
    const capturedHeader = result[CAPTURED_COOKIE_HEADER_KEY];
    return isCapturedCookieHeader(capturedHeader) ? capturedHeader : null;
  }

  const rawHeader = window.localStorage.getItem(CAPTURED_COOKIE_HEADER_KEY);

  if (!rawHeader) {
    return null;
  }

  try {
    const parsedHeader: unknown = JSON.parse(rawHeader);
    return isCapturedCookieHeader(parsedHeader) ? parsedHeader : null;
  } catch {
    return null;
  }
}

export async function clearCapturedCookieHeader(): Promise<void> {
  if (hasChromeSessionStorage()) {
    await chrome.storage.session.remove(CAPTURED_COOKIE_HEADER_KEY);
    return;
  }

  if (hasChromeStorage()) {
    await chrome.storage.local.remove(CAPTURED_COOKIE_HEADER_KEY);
    return;
  }

  window.localStorage.removeItem(CAPTURED_COOKIE_HEADER_KEY);
}

export function subscribeCapturedCookieHeaderChanges(callback: () => void): () => void {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return () => {};
  }

  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (
      (areaName === "session" || areaName === "local") &&
      changes[CAPTURED_COOKIE_HEADER_KEY]
    ) {
      callback();
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

export async function saveCapturedCookieHeader(header: CapturedCookieHeader): Promise<void> {
  if (hasChromeSessionStorage()) {
    await chrome.storage.session.set({ [CAPTURED_COOKIE_HEADER_KEY]: header });
    return;
  }

  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [CAPTURED_COOKIE_HEADER_KEY]: header });
    return;
  }

  window.localStorage.setItem(CAPTURED_COOKIE_HEADER_KEY, JSON.stringify(header));
}
