import type {
  PasswordEntry,
  PasswordEntryDraft,
  PasswordVaultExport
} from "./types";
import { getHostname, normalizeUrl } from "./urlMatcher";

const LEGACY_STORAGE_KEY = "toolbooox.passwordVault.entries";
const DATABASE_NAME = "toolbooox.passwordVault";
const DATABASE_VERSION = 1;
const ENTRY_STORE_NAME = "passwordEntries";
const METADATA_STORE_NAME = "metadata";
const MIGRATION_METADATA_KEY = "legacyStorageMigrated";

type StoredPasswordEntry = PasswordEntry & {
  readonly schemaVersion: 1;
  readonly passwordEncoding: "plain";
  readonly encryptionVersion: null;
  readonly sortOrder: number;
};

type MetadataRecord = {
  readonly key: string;
  readonly value: unknown;
};

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
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

      if (!database.objectStoreNames.contains(ENTRY_STORE_NAME)) {
        const entryStore = database.createObjectStore(ENTRY_STORE_NAME, {
          keyPath: "id"
        });
        entryStore.createIndex("hostname", "hostname", { unique: false });
        entryStore.createIndex("createdAt", "createdAt", { unique: false });
        entryStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!database.objectStoreNames.contains(METADATA_STORE_NAME)) {
        database.createObjectStore(METADATA_STORE_NAME, {
          keyPath: "key"
        });
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function readLegacyEntries(): Promise<PasswordEntry[]> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(LEGACY_STORAGE_KEY);
    return Array.isArray(result[LEGACY_STORAGE_KEY]) ? result[LEGACY_STORAGE_KEY] : [];
  }

  const rawValue = window.localStorage.getItem(LEGACY_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? (parsedValue as PasswordEntry[]) : [];
  } catch {
    return [];
  }
}

async function clearLegacyEntries(): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
    return;
  }

  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

async function writeLegacyEntries(entries: readonly PasswordEntry[]): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [LEGACY_STORAGE_KEY]: entries });
    return;
  }

  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(entries));
}

async function getMetadata(database: IDBDatabase, key: string): Promise<unknown> {
  const transaction = database.transaction(METADATA_STORE_NAME, "readonly");
  const record = await requestToPromise<MetadataRecord | undefined>(
    transaction.objectStore(METADATA_STORE_NAME).get(key)
  );

  return record?.value;
}

async function setMetadata(database: IDBDatabase, key: string, value: unknown): Promise<void> {
  const transaction = database.transaction(METADATA_STORE_NAME, "readwrite");
  transaction.objectStore(METADATA_STORE_NAME).put({ key, value });
  await transactionToPromise(transaction);
}

function toStoredEntry(entry: PasswordEntry, sortOrder: number): StoredPasswordEntry {
  return {
    ...entry,
    schemaVersion: 1,
    passwordEncoding: "plain",
    encryptionVersion: null,
    sortOrder
  };
}

function toPasswordEntry(entry: StoredPasswordEntry): PasswordEntry {
  return {
    id: entry.id,
    displayName: entry.displayName,
    url: entry.url,
    hostname: entry.hostname,
    username: entry.username,
    password: entry.password,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

async function readIndexedDbEntries(database: IDBDatabase): Promise<PasswordEntry[]> {
  const transaction = database.transaction(ENTRY_STORE_NAME, "readonly");
  const entries = await requestToPromise<StoredPasswordEntry[]>(
    transaction.objectStore(ENTRY_STORE_NAME).getAll()
  );

  return entries
    .sort((leftEntry, rightEntry) => leftEntry.sortOrder - rightEntry.sortOrder)
    .map(toPasswordEntry);
}

async function writeIndexedDbEntries(
  database: IDBDatabase,
  entries: readonly PasswordEntry[]
): Promise<void> {
  const transaction = database.transaction(ENTRY_STORE_NAME, "readwrite");
  const store = transaction.objectStore(ENTRY_STORE_NAME);
  store.clear();
  entries.forEach((entry, index) => {
    store.put(toStoredEntry(entry, index));
  });
  await transactionToPromise(transaction);
}

async function migrateLegacyStorage(database: IDBDatabase): Promise<void> {
  const hasMigrated = await getMetadata(database, MIGRATION_METADATA_KEY);

  if (hasMigrated === true) {
    return;
  }

  const legacyEntries = await readLegacyEntries();
  const currentEntries = await readIndexedDbEntries(database);

  if (legacyEntries.length > 0 && currentEntries.length === 0) {
    await writeIndexedDbEntries(database, legacyEntries);
  }

  await clearLegacyEntries();
  await setMetadata(database, MIGRATION_METADATA_KEY, true);
}

async function readEntries(): Promise<PasswordEntry[]> {
  if (!hasIndexedDb()) {
    return readLegacyEntries();
  }

  const database = await openDatabase();
  await migrateLegacyStorage(database);
  return readIndexedDbEntries(database);
}

async function writeEntries(entries: readonly PasswordEntry[]): Promise<void> {
  if (!hasIndexedDb()) {
    await writeLegacyEntries(entries);
    return;
  }

  const database = await openDatabase();
  await migrateLegacyStorage(database);
  await writeIndexedDbEntries(database, entries);
}

function createId(): string {
  return crypto.randomUUID();
}

function createEntry(draft: PasswordEntryDraft, existingEntry?: PasswordEntry): PasswordEntry {
  const now = new Date().toISOString();
  const normalizedUrl = normalizeUrl(draft.url);

  return {
    id: existingEntry?.id ?? createId(),
    displayName: draft.displayName.trim(),
    url: normalizedUrl,
    hostname: getHostname(normalizedUrl),
    username: draft.username.trim(),
    password: draft.password,
    createdAt: existingEntry?.createdAt ?? now,
    updatedAt: now
  };
}

export async function getPasswordEntries(): Promise<PasswordEntry[]> {
  return readEntries();
}

export async function savePasswordEntry(
  draft: PasswordEntryDraft,
  editingId?: string
): Promise<PasswordEntry[]> {
  const entries = await readEntries();
  const existingEntry = editingId
    ? entries.find((entry) => entry.id === editingId)
    : undefined;
  const nextEntry = createEntry(draft, existingEntry);
  const nextEntries = existingEntry
    ? entries.map((entry) => (entry.id === editingId ? nextEntry : entry))
    : [nextEntry, ...entries];

  await writeEntries(nextEntries);
  return nextEntries;
}

export async function deletePasswordEntry(id: string): Promise<PasswordEntry[]> {
  const entries = await readEntries();
  const nextEntries = entries.filter((entry) => entry.id !== id);
  await writeEntries(nextEntries);
  return nextEntries;
}

export async function replacePasswordEntries(
  entries: readonly PasswordEntryDraft[]
): Promise<PasswordEntry[]> {
  const sanitizedEntries = entries.map((entry) => createEntry(entry));
  await writeEntries(sanitizedEntries);
  return sanitizedEntries;
}

export function createPasswordVaultExport(
  entries: readonly PasswordEntry[]
): PasswordVaultExport {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries
  };
}
