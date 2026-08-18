import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  deleteAddressNavigationItem,
  getAddressNavigationItems,
  isValidAddressNavigationUrl,
  saveAddressNavigationItem
} from "./storage";

const databaseName = "toolbooox.addressNavigation";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function readRawItems(): Promise<Array<Record<string, unknown>>> {
  const database = await requestToPromise(indexedDB.open(databaseName, 1));
  const transaction = database.transaction("items", "readonly");
  const items = await requestToPromise<Array<Record<string, unknown>>>(
    transaction.objectStore("items").getAll()
  );
  database.close();

  return items;
}

describe("address navigation storage", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "address-id")
    });
    await requestToPromise(indexedDB.deleteDatabase(databaseName));
  });

  it("creates address navigation items locally", async () => {
    const items = await saveAddressNavigationItem([], {
      title: "  Docs  ",
      remark: "  Daily reference  ",
      url: "example.com/docs"
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "address-id",
      title: "Docs",
      remark: "Daily reference",
      url: "https://example.com/docs"
    });
    expect(await readRawItems()).toHaveLength(1);
  });

  it("validates website URLs", () => {
    expect(isValidAddressNavigationUrl("https://example.com")).toBe(true);
    expect(isValidAddressNavigationUrl("example.com/path")).toBe(true);
    expect(isValidAddressNavigationUrl("localhost:5173")).toBe(true);
    expect(isValidAddressNavigationUrl("127.0.0.1:5173")).toBe(true);
    expect(isValidAddressNavigationUrl("ftp://example.com")).toBe(false);
    expect(isValidAddressNavigationUrl("not a url")).toBe(false);
    expect(isValidAddressNavigationUrl("example")).toBe(false);
    expect(isValidAddressNavigationUrl("中文")).toBe(false);
    expect(isValidAddressNavigationUrl("中文.com")).toBe(false);
  });

  it("deletes existing items", async () => {
    const created = await saveAddressNavigationItem([], {
      title: "Docs",
      remark: "",
      url: "https://example.com"
    });
    const deleted = await deleteAddressNavigationItem(created, created[0].id);

    expect(deleted).toEqual([]);
    expect(await getAddressNavigationItems()).toEqual([]);
    expect(await readRawItems()).toEqual([]);
  });

  it("updates existing items", async () => {
    const created = await saveAddressNavigationItem([], {
      title: "Old Docs",
      remark: "Old remark",
      url: "old.example.com"
    });
    const updated = await saveAddressNavigationItem(
      created,
      {
        title: "New Docs",
        remark: "New remark",
        url: "new.example.com"
      },
      created[0].id
    );

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      id: created[0].id,
      title: "New Docs",
      remark: "New remark",
      url: "https://new.example.com/"
    });
    expect(updated[0].createdAt).toBe(created[0].createdAt);
    expect(await getAddressNavigationItems()).toEqual(updated);
  });

});
