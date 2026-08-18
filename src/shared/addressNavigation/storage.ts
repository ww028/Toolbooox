export type AddressNavigationItem = {
  readonly id: string;
  readonly title: string;
  readonly remark: string;
  readonly url: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AddressNavigationDraft = {
  readonly title: string;
  readonly remark: string;
  readonly url: string;
};

const ADDRESS_NAVIGATION_STORAGE_KEY = "toolbooox.addressNavigation.items";

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function isAddressNavigationItem(value: unknown): value is AddressNavigationItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<AddressNavigationItem>;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.remark === "string" &&
    typeof item.url === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function normalizeAddressNavigationItems(value: unknown): AddressNavigationItem[] {
  return Array.isArray(value)
    ? value.filter(isAddressNavigationItem).map((item) => ({
        ...item,
        title: item.title.trim(),
        remark: item.remark.trim(),
        url: item.url.trim()
      }))
    : [];
}

function isIpv4Hostname(hostname: string): boolean {
  const parts = hostname.split(".");

  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d+$/.test(part)) {
        return false;
      }

      const value = Number(part);
      return value >= 0 && value <= 255;
    })
  );
}

function isValidDomainHostname(hostname: string): boolean {
  const labels = hostname.split(".");

  return (
    labels.length >= 2 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)) &&
    /^[a-z]{2,}$/i.test(labels[labels.length - 1])
  );
}

function isValidWebsiteHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    isIpv4Hostname(hostname) ||
    isValidDomainHostname(hostname)
  );
}

function normalizeUrl(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    if (/[^\x00-\x7F]/.test(trimmedValue)) {
      return null;
    }

    const hasProtocol = /^https?:\/\//i.test(trimmedValue);
    const hasUnsupportedProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedValue) && !hasProtocol;

    if (hasUnsupportedProtocol) {
      return null;
    }

    const url = new URL(hasProtocol ? trimmedValue : `https://${trimmedValue}`);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    if (!url.hostname) {
      return null;
    }

    if (!isValidWebsiteHostname(url.hostname)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function isValidAddressNavigationUrl(value: string): boolean {
  return normalizeUrl(value) !== null;
}

async function writeAddressNavigationItems(
  items: readonly AddressNavigationItem[]
): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [ADDRESS_NAVIGATION_STORAGE_KEY]: items });
    return;
  }

  window.localStorage.setItem(ADDRESS_NAVIGATION_STORAGE_KEY, JSON.stringify(items));
}

export async function getAddressNavigationItems(): Promise<AddressNavigationItem[]> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(ADDRESS_NAVIGATION_STORAGE_KEY);
    return normalizeAddressNavigationItems(result[ADDRESS_NAVIGATION_STORAGE_KEY]);
  }

  const rawItems = window.localStorage.getItem(ADDRESS_NAVIGATION_STORAGE_KEY);

  if (!rawItems) {
    return [];
  }

  try {
    return normalizeAddressNavigationItems(JSON.parse(rawItems));
  } catch {
    return [];
  }
}

export async function saveAddressNavigationItem(
  items: readonly AddressNavigationItem[],
  draft: AddressNavigationDraft,
  editingId: string | null = null
): Promise<AddressNavigationItem[]> {
  const normalizedUrl = normalizeUrl(draft.url);

  if (!normalizedUrl) {
    throw new Error("INVALID_URL");
  }

  const now = new Date().toISOString();
  const existingItem = editingId ? items.find((item) => item.id === editingId) : undefined;
  const nextItem: AddressNavigationItem = {
    id: existingItem?.id ?? crypto.randomUUID(),
    title: draft.title.trim(),
    remark: draft.remark.trim(),
    url: normalizedUrl,
    createdAt: existingItem?.createdAt ?? now,
    updatedAt: now
  };
  const nextItems = existingItem
    ? items.map((item) => (item.id === existingItem.id ? nextItem : item))
    : [nextItem, ...items];

  await writeAddressNavigationItems(nextItems);
  return nextItems;
}

export async function deleteAddressNavigationItem(
  items: readonly AddressNavigationItem[],
  itemId: string
): Promise<AddressNavigationItem[]> {
  const nextItems = items.filter((item) => item.id !== itemId);

  await writeAddressNavigationItems(nextItems);
  return nextItems;
}
