import {
  getIndexedDbValue,
  setIndexedDbValue
} from "../storage/indexedDbKeyValue";

export type DomainSwitcherDraft = {
  readonly onlineDomain: string;
  readonly localDomain: string;
};

export type DomainSwitcherRule = DomainSwitcherDraft & {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type DomainSwitchSource = "online" | "local";

export type DomainSwitchResult = {
  readonly nextUrl: string;
  readonly source: DomainSwitchSource;
};

const DOMAIN_SWITCHER_STORAGE_KEY = "toolbooox.devTools.domainSwitcher";

function isDomainSwitcherDraft(value: unknown): value is DomainSwitcherDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as Partial<DomainSwitcherDraft>;
  return typeof config.onlineDomain === "string" && typeof config.localDomain === "string";
}

function isDomainSwitcherRule(value: unknown): value is DomainSwitcherRule {
  if (!isDomainSwitcherDraft(value)) {
    return false;
  }

  const rule = value as Partial<DomainSwitcherRule>;
  return (
    typeof rule.id === "string" &&
    typeof rule.createdAt === "string" &&
    typeof rule.updatedAt === "string"
  );
}

function createId(): string {
  return crypto.randomUUID();
}

function sanitizeDraft(draft: DomainSwitcherDraft): DomainSwitcherDraft {
  return {
    onlineDomain: draft.onlineDomain.trim(),
    localDomain: draft.localDomain.trim()
  };
}

function inferProtocol(hostname: string): "http:" | "https:" {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  ) {
    return "http:";
  }

  return "https:";
}

function parseEndpoint(value: string): URL | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const hasProtocol = /^https?:\/\//i.test(trimmedValue);
    const endpointUrl = new URL(hasProtocol ? trimmedValue : `https://${trimmedValue}`);

    if (endpointUrl.protocol !== "http:" && endpointUrl.protocol !== "https:") {
      return null;
    }

    if (!hasProtocol) {
      endpointUrl.protocol = inferProtocol(endpointUrl.hostname);
    }

    return endpointUrl;
  } catch {
    return null;
  }
}

function isSameEndpoint(currentUrl: URL, endpointUrl: URL): boolean {
  return currentUrl.host.toLowerCase() === endpointUrl.host.toLowerCase();
}

function replaceEndpoint(currentUrl: URL, targetUrl: URL): string {
  const nextUrl = new URL(currentUrl.toString());
  nextUrl.protocol = targetUrl.protocol;
  nextUrl.hostname = targetUrl.hostname;
  nextUrl.port = targetUrl.port;
  nextUrl.username = "";
  nextUrl.password = "";

  return nextUrl.toString();
}

function createRule(draft: DomainSwitcherDraft, existingRule?: DomainSwitcherRule): DomainSwitcherRule {
  const now = new Date().toISOString();
  const sanitizedDraft = sanitizeDraft(draft);

  return {
    id: existingRule?.id ?? createId(),
    onlineDomain: sanitizedDraft.onlineDomain,
    localDomain: sanitizedDraft.localDomain,
    createdAt: existingRule?.createdAt ?? now,
    updatedAt: now
  };
}

function normalizeStoredRules(value: unknown): DomainSwitcherRule[] {
  if (Array.isArray(value)) {
    return value.filter(isDomainSwitcherRule).map((rule) => ({
      ...rule,
      onlineDomain: rule.onlineDomain.trim(),
      localDomain: rule.localDomain.trim()
    }));
  }

  if (isDomainSwitcherDraft(value)) {
    return [createRule(value)];
  }

  return [];
}

async function writeStoredRules(rules: readonly DomainSwitcherRule[]): Promise<void> {
  await setIndexedDbValue(DOMAIN_SWITCHER_STORAGE_KEY, rules);
}

export function isValidDomainSwitcherDraft(draft: DomainSwitcherDraft): boolean {
  return Boolean(parseEndpoint(draft.onlineDomain) && parseEndpoint(draft.localDomain));
}

export function buildSwitchedDomainUrl(
  currentUrlValue: string,
  draft: DomainSwitcherDraft
): DomainSwitchResult | null {
  const onlineUrl = parseEndpoint(draft.onlineDomain);
  const localUrl = parseEndpoint(draft.localDomain);

  if (!onlineUrl || !localUrl) {
    return null;
  }

  let currentUrl: URL;

  try {
    currentUrl = new URL(currentUrlValue);
  } catch {
    return null;
  }

  if (isSameEndpoint(currentUrl, onlineUrl)) {
    return {
      nextUrl: replaceEndpoint(currentUrl, localUrl),
      source: "online"
    };
  }

  if (isSameEndpoint(currentUrl, localUrl)) {
    return {
      nextUrl: replaceEndpoint(currentUrl, onlineUrl),
      source: "local"
    };
  }

  return null;
}

export async function getDomainSwitcherRules(): Promise<DomainSwitcherRule[]> {
  return normalizeStoredRules(await getIndexedDbValue(DOMAIN_SWITCHER_STORAGE_KEY));
}

export async function saveDomainSwitcherRule(
  rules: readonly DomainSwitcherRule[],
  draft: DomainSwitcherDraft,
  editingId: string | null
): Promise<{
  readonly rules: DomainSwitcherRule[];
  readonly savedRule: DomainSwitcherRule;
}> {
  const existingRule = editingId ? rules.find((rule) => rule.id === editingId) : undefined;
  const savedRule = createRule(draft, existingRule);
  const nextRules = existingRule
    ? rules.map((rule) => (rule.id === existingRule.id ? savedRule : rule))
    : [savedRule, ...rules];

  await writeStoredRules(nextRules);

  return {
    rules: nextRules,
    savedRule
  };
}

export async function deleteDomainSwitcherRule(
  rules: readonly DomainSwitcherRule[],
  id: string
): Promise<DomainSwitcherRule[]> {
  const nextRules = rules.filter((rule) => rule.id !== id);
  await writeStoredRules(nextRules);
  return nextRules;
}
