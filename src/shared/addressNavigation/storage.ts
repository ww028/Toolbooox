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

const DATABASE_NAME = "toolbooox.addressNavigation";
const DATABASE_VERSION = 1;
const ITEM_STORE_NAME = "items";

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
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

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error));
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(ITEM_STORE_NAME)) {
        const itemStore = database.createObjectStore(ITEM_STORE_NAME, {
          keyPath: "id"
        });
        itemStore.createIndex("createdAt", "createdAt", { unique: false });
        itemStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function readIndexedDbAddressNavigationItems(
  database: IDBDatabase
): Promise<AddressNavigationItem[]> {
  const transaction = database.transaction(ITEM_STORE_NAME, "readonly");
  const items = await requestToPromise<AddressNavigationItem[]>(
    transaction.objectStore(ITEM_STORE_NAME).getAll()
  );

  return normalizeAddressNavigationItems(items).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

async function replaceIndexedDbAddressNavigationItems(
  database: IDBDatabase,
  items: readonly AddressNavigationItem[]
): Promise<void> {
  const transaction = database.transaction(ITEM_STORE_NAME, "readwrite");
  const itemStore = transaction.objectStore(ITEM_STORE_NAME);
  itemStore.clear();

  normalizeAddressNavigationItems(items).forEach((item) => {
    itemStore.put(item);
  });

  await transactionToPromise(transaction);
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
  if (!hasIndexedDb()) {
    throw new Error("INDEXED_DB_UNAVAILABLE");
  }

  const database = await openDatabase();

  try {
    await replaceIndexedDbAddressNavigationItems(database, items);
  } finally {
    database.close();
  }
}

export async function getAddressNavigationItems(): Promise<AddressNavigationItem[]> {
  if (!hasIndexedDb()) {
    return [];
  }

  const database = await openDatabase();

  try {
    return await readIndexedDbAddressNavigationItems(database);
  } finally {
    database.close();
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
