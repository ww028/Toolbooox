import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  getPasswordEntries,
  PasswordVaultError,
  replacePasswordEntries,
  savePasswordEntry
} from "./storage";
import type { PasswordEntry } from "./types";

const databaseName = "toolbooox.passwordVault";
const legacyStorageKey = "toolbooox.passwordVault.entries";
const encryptionKeyStorageKey = "toolbooox.passwordVault.encryptionKey.v1";

type StoredValue = Record<string, unknown>;

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

function createChromeMock(storage: StoredValue) {
  return {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({
          [key]: storage[key]
        })),
        set: vi.fn(async (value: StoredValue) => {
          Object.assign(storage, value);
        }),
        remove: vi.fn(async (key: string) => {
          delete storage[key];
        })
      }
    }
  };
}

async function readRawStoredEntries(): Promise<Array<Record<string, unknown>>> {
  const database = await requestToPromise(indexedDB.open(databaseName, 1));
  const transaction = database.transaction("passwordEntries", "readonly");
  const entries = await requestToPromise<Array<Record<string, unknown>>>(
    transaction.objectStore("passwordEntries").getAll()
  );
  database.close();

  return entries;
}

async function clearMigrationMetadata(): Promise<void> {
  const database = await requestToPromise(indexedDB.open(databaseName, 1));
  const transaction = database.transaction("metadata", "readwrite");
  transaction.objectStore("metadata").delete("legacyStorageMigrated");
  await transactionToPromise(transaction);
  database.close();
}

describe("passwordVault storage", () => {
  let chromeStorage: StoredValue;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal("indexedDB", new IDBFactory());
    chromeStorage = {};
    vi.stubGlobal("chrome", createChromeMock(chromeStorage));
    await requestToPromise(indexedDB.deleteDatabase(databaseName));
  });

  it("stores encrypted passwords in IndexedDB and returns decrypted entries", async () => {
    await savePasswordEntry({
      displayName: "Work",
      url: "https://example.com/login",
      username: "alice",
      password: "secret-password"
    });

    const entries = await getPasswordEntries();
    const rawEntries = await readRawStoredEntries();

    expect(entries[0]?.password).toBe("secret-password");
    expect(rawEntries[0]?.password).not.toBe("secret-password");
    expect(rawEntries[0]?.passwordEncoding).toBe("aes-gcm");
    expect(rawEntries[0]?.encryptionVersion).toBe(1);
    expect(typeof rawEntries[0]?.iv).toBe("string");
    expect(typeof chromeStorage[encryptionKeyStorageKey]).toBe("string");
  });

  it("rejects invalid URLs before saving", async () => {
    await expect(
      savePasswordEntry({
        displayName: "Broken",
        url: "not a valid url",
        username: "alice",
        password: "secret"
      })
    ).rejects.toMatchObject(new PasswordVaultError("INVALID_URL"));

    expect(await getPasswordEntries()).toEqual([]);
  });

  it("rejects duplicate hostname and username combinations", async () => {
    await savePasswordEntry({
      displayName: "First",
      url: "https://example.com/login",
      username: "Alice",
      password: "secret-1"
    });

    await expect(
      savePasswordEntry({
        displayName: "Second",
        url: "example.com/dashboard",
        username: "alice",
        password: "secret-2"
      })
    ).rejects.toMatchObject(new PasswordVaultError("DUPLICATE_ENTRY"));
  });

  it("rejects invalid import payload entries without replacing existing data", async () => {
    await savePasswordEntry({
      displayName: "Existing",
      url: "https://example.com",
      username: "alice",
      password: "secret"
    });

    await expect(
      replacePasswordEntries([
        {
          displayName: "Invalid",
          url: "bad url",
          username: "bob",
          password: "secret"
        }
      ])
    ).rejects.toMatchObject(new PasswordVaultError("INVALID_URL"));

    expect((await getPasswordEntries()).map((entry) => entry.displayName)).toEqual(["Existing"]);
  });

  it("merges legacy chrome.storage entries into existing IndexedDB entries", async () => {
    const legacyEntry: PasswordEntry = {
      id: "legacy-id",
      displayName: "Legacy",
      url: "https://legacy.example.com",
      hostname: "legacy.example.com",
      username: "legacy-user",
      password: "legacy-secret",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    await savePasswordEntry({
      displayName: "Current",
      url: "https://current.example.com",
      username: "current-user",
      password: "current-secret"
    });
    chromeStorage[legacyStorageKey] = [legacyEntry];
    await clearMigrationMetadata();

    const entries = await getPasswordEntries();

    expect(entries.map((entry) => entry.displayName)).toEqual(["Current", "Legacy"]);
    expect(chromeStorage[legacyStorageKey]).toBeUndefined();
  });
});
