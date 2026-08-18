import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteAddressNavigationItem,
  getAddressNavigationItems,
  isValidAddressNavigationUrl,
  saveAddressNavigationItem
} from "./storage";

const storageKey = "toolbooox.addressNavigation.items";

type StoredValue = Record<string, unknown>;

function createChromeMock(storage: StoredValue) {
  return {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({
          [key]: storage[key]
        })),
        set: vi.fn(async (value: StoredValue) => {
          Object.assign(storage, value);
        })
      }
    }
  };
}

describe("address navigation storage", () => {
  let chromeStorage: StoredValue;

  beforeEach(() => {
    vi.restoreAllMocks();
    chromeStorage = {};
    vi.stubGlobal("chrome", createChromeMock(chromeStorage));
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "address-id")
    });
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
    expect(chromeStorage[storageKey]).toEqual(items);
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
    expect(chromeStorage[storageKey]).toEqual([]);
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
    expect(chromeStorage[storageKey]).toEqual(updated);
  });
});
