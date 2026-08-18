import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  getPasswordEntries,
  PasswordVaultError,
  replacePasswordEntries,
  savePasswordEntry
} from "./storage";

const databaseName = "toolbooox.passwordVault";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
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

describe("passwordVault storage", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal("indexedDB", new IDBFactory());
    await requestToPromise(indexedDB.deleteDatabase(databaseName));
  });

  it("stores encrypted passwords in IndexedDB and returns decrypted entries", async () => {
    await savePasswordEntry({
      displayName: "Work",
      url: "https://example.test/login",
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
      url: "https://example.test/login",
      username: "Alice",
      password: "secret-1"
    });

    await expect(
      savePasswordEntry({
        displayName: "Second",
        url: "example.test/dashboard",
        username: "alice",
        password: "secret-2"
      })
    ).rejects.toMatchObject(new PasswordVaultError("DUPLICATE_ENTRY"));
  });

  it("rejects invalid import payload entries without replacing existing data", async () => {
    await savePasswordEntry({
      displayName: "Existing",
      url: "https://example.test",
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

});
