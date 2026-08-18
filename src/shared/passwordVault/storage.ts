import type {
  PasswordEntry,
  PasswordEntryDraft,
  PasswordVaultExport
} from "./types";
import { getHostname, normalizeUrl } from "./urlMatcher";
import {
  getIndexedDbValue,
  setIndexedDbValue
} from "../storage/indexedDbKeyValue";

const ENCRYPTION_KEY_STORAGE_KEY = "toolbooox.passwordVault.encryptionKey.v1";
const DATABASE_NAME = "toolbooox.passwordVault";
const DATABASE_VERSION = 1;
const ENTRY_STORE_NAME = "passwordEntries";

type PasswordVaultErrorCode = "DUPLICATE_ENTRY" | "INVALID_URL";

export class PasswordVaultError extends Error {
  readonly code: PasswordVaultErrorCode;

  constructor(code: PasswordVaultErrorCode) {
    super(code);
    this.name = "PasswordVaultError";
    this.code = code;
  }
}

type EncryptedStoredPasswordEntry = Omit<PasswordEntry, "password"> & {
  readonly password: string;
  readonly schemaVersion: 1;
  readonly passwordEncoding: "aes-gcm";
  readonly encryptionVersion: 1;
  readonly iv: string;
  readonly sortOrder: number;
};

type PlainStoredPasswordEntry = PasswordEntry & {
  readonly schemaVersion?: 1;
  readonly passwordEncoding?: "plain";
  readonly encryptionVersion?: null;
  readonly sortOrder?: number;
};

type StoredPasswordEntry = EncryptedStoredPasswordEntry | PlainStoredPasswordEntry;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binaryValue = "";

  bytes.forEach((byte) => {
    binaryValue += String.fromCharCode(byte);
  });

  return btoa(binaryValue);
}

function base64ToBytes(value: string): Uint8Array {
  const binaryValue = atob(value);
  const bytes = new Uint8Array(binaryValue.length);

  for (let index = 0; index < binaryValue.length; index += 1) {
    bytes[index] = binaryValue.charCodeAt(index);
  }

  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function readStoredEncryptionKey(): Promise<string | null> {
  const storedKey = await getIndexedDbValue(ENCRYPTION_KEY_STORAGE_KEY);
  return typeof storedKey === "string" ? storedKey : null;
}

async function writeStoredEncryptionKey(rawKey: string): Promise<void> {
  await setIndexedDbValue(ENCRYPTION_KEY_STORAGE_KEY, rawKey);
}

async function getEncryptionKey(): Promise<CryptoKey> {
  if (!crypto.subtle) {
    throw new Error("Web Crypto API is unavailable.");
  }

  const existingRawKey = await readStoredEncryptionKey();
  const rawKey = existingRawKey ?? bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));

  if (!existingRawKey) {
    await writeStoredEncryptionKey(rawKey);
  }

  return crypto.subtle.importKey(
    "raw",
    bytesToArrayBuffer(base64ToBytes(rawKey)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPassword(password: string): Promise<{
  readonly ciphertext: string;
  readonly iv: string;
}> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedValue = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    bytesToArrayBuffer(new TextEncoder().encode(password))
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encryptedValue)),
    iv: bytesToBase64(iv)
  };
}

async function decryptPassword(ciphertext: string, iv: string): Promise<string> {
  const key = await getEncryptionKey();
  const decryptedValue = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(base64ToBytes(iv)) },
    key,
    bytesToArrayBuffer(base64ToBytes(ciphertext))
  );

  return new TextDecoder().decode(decryptedValue);
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
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function toStoredEntry(
  entry: PasswordEntry,
  sortOrder: number
): Promise<EncryptedStoredPasswordEntry> {
  const encryptedPassword = await encryptPassword(entry.password);

  return {
    id: entry.id,
    displayName: entry.displayName,
    url: entry.url,
    hostname: entry.hostname,
    username: entry.username,
    password: encryptedPassword.ciphertext,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    schemaVersion: 1,
    passwordEncoding: "aes-gcm",
    encryptionVersion: 1,
    iv: encryptedPassword.iv,
    sortOrder
  };
}

async function toPasswordEntry(entry: StoredPasswordEntry): Promise<PasswordEntry> {
  return {
    id: entry.id,
    displayName: entry.displayName,
    url: entry.url,
    hostname: entry.hostname,
    username: entry.username,
    password:
      entry.passwordEncoding === "aes-gcm"
        ? await decryptPassword(entry.password, entry.iv)
        : entry.password,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

async function readIndexedDbEntries(database: IDBDatabase): Promise<PasswordEntry[]> {
  const transaction = database.transaction(ENTRY_STORE_NAME, "readonly");
  const entries = await requestToPromise<StoredPasswordEntry[]>(
    transaction.objectStore(ENTRY_STORE_NAME).getAll()
  );
  const sortedEntries = entries.sort(
    (leftEntry, rightEntry) => (leftEntry.sortOrder ?? 0) - (rightEntry.sortOrder ?? 0)
  );

  return Promise.all(sortedEntries.map(toPasswordEntry));
}

async function writeIndexedDbEntries(
  database: IDBDatabase,
  entries: readonly PasswordEntry[]
): Promise<void> {
  const storedEntries = await Promise.all(
    entries.map((entry, index) => toStoredEntry(entry, index))
  );
  const transaction = database.transaction(ENTRY_STORE_NAME, "readwrite");
  const store = transaction.objectStore(ENTRY_STORE_NAME);
  store.clear();
  storedEntries.forEach((entry) => {
    store.put(entry);
  });
  await transactionToPromise(transaction);
}

async function readEntries(): Promise<PasswordEntry[]> {
  if (!hasIndexedDb()) {
    return [];
  }

  const database = await openDatabase();

  try {
    return await readIndexedDbEntries(database);
  } finally {
    database.close();
  }
}

async function writeEntries(entries: readonly PasswordEntry[]): Promise<void> {
  if (!hasIndexedDb()) {
    throw new Error("INDEXED_DB_UNAVAILABLE");
  }

  const database = await openDatabase();

  try {
    await writeIndexedDbEntries(database, entries);
  } finally {
    database.close();
  }
}

function createId(): string {
  return crypto.randomUUID();
}

function createEntry(draft: PasswordEntryDraft, existingEntry?: PasswordEntry): PasswordEntry {
  const now = new Date().toISOString();
  const normalizedUrl = normalizeUrl(draft.url);
  const hostname = getHostname(normalizedUrl);

  if (!hostname) {
    throw new PasswordVaultError("INVALID_URL");
  }

  return {
    id: existingEntry?.id ?? createId(),
    displayName: draft.displayName.trim(),
    url: normalizedUrl,
    hostname,
    username: draft.username.trim(),
    password: draft.password,
    createdAt: existingEntry?.createdAt ?? now,
    updatedAt: now
  };
}

function assertNoDuplicateEntry(
  entries: readonly PasswordEntry[],
  nextEntry: PasswordEntry,
  editingId?: string
): void {
  const hasDuplicate = entries.some(
    (entry) =>
      entry.id !== editingId &&
      entry.hostname === nextEntry.hostname &&
      entry.username.toLowerCase() === nextEntry.username.toLowerCase()
  );

  if (hasDuplicate) {
    throw new PasswordVaultError("DUPLICATE_ENTRY");
  }
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
  assertNoDuplicateEntry(entries, nextEntry, editingId);
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
  sanitizedEntries.forEach((entry, index) => {
    assertNoDuplicateEntry(sanitizedEntries.slice(0, index), entry);
  });
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
