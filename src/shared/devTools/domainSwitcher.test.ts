import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSwitchedDomainUrl,
  deleteDomainSwitcherRule,
  getDomainSwitcherRules,
  saveDomainSwitcherRule
} from "./domainSwitcher";

const storageKey = "toolbooox.devTools.domainSwitcher";

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

describe("domainSwitcher", () => {
  let chromeStorage: StoredValue;

  beforeEach(() => {
    vi.restoreAllMocks();
    chromeStorage = {};
    vi.stubGlobal("chrome", createChromeMock(chromeStorage));
  });

  it("switches from online domain to local development domain", () => {
    expect(
      buildSwitchedDomainUrl("https://www.example.com/users?id=1#profile", {
        onlineDomain: "www.example.com",
        localDomain: "localhost:5173"
      })
    ).toEqual({
      nextUrl: "http://localhost:5173/users?id=1#profile",
      source: "online"
    });
  });

  it("switches from local development domain to online domain", () => {
    expect(
      buildSwitchedDomainUrl("http://localhost:5173/users?id=1#profile", {
        onlineDomain: "www.example.com",
        localDomain: "localhost:5173"
      })
    ).toEqual({
      nextUrl: "https://www.example.com/users?id=1#profile",
      source: "local"
    });
  });

  it("keeps explicit target protocol when provided", () => {
    expect(
      buildSwitchedDomainUrl("https://www.example.com/dashboard", {
        onlineDomain: "https://www.example.com",
        localDomain: "http://dev.example.test:3000"
      })
    ).toEqual({
      nextUrl: "http://dev.example.test:3000/dashboard",
      source: "online"
    });
  });

  it("returns null when the current URL does not match either domain", () => {
    expect(
      buildSwitchedDomainUrl("https://other.example.com/dashboard", {
        onlineDomain: "www.example.com",
        localDomain: "localhost:5173"
      })
    ).toBeNull();
  });

  it("returns null for invalid configuration", () => {
    expect(
      buildSwitchedDomainUrl("https://www.example.com/dashboard", {
        onlineDomain: "",
        localDomain: "localhost:5173"
      })
    ).toBeNull();
  });

  it("reads legacy single-pair config as a saved rule", async () => {
    chromeStorage[storageKey] = {
      onlineDomain: "www.example.com",
      localDomain: "localhost:5173"
    };

    const rules = await getDomainSwitcherRules();

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      onlineDomain: "www.example.com",
      localDomain: "localhost:5173"
    });
    expect(typeof rules[0]?.id).toBe("string");
  });

  it("creates and updates saved domain rules", async () => {
    const created = await saveDomainSwitcherRule(
      [],
      {
        onlineDomain: "www.example.com",
        localDomain: "localhost:5173"
      },
      null
    );
    const updated = await saveDomainSwitcherRule(
      created.rules,
      {
        onlineDomain: "admin.example.com",
        localDomain: "localhost:3000"
      },
      created.savedRule.id
    );

    expect(updated.rules).toHaveLength(1);
    expect(updated.savedRule.id).toBe(created.savedRule.id);
    expect(updated.savedRule).toMatchObject({
      onlineDomain: "admin.example.com",
      localDomain: "localhost:3000"
    });
    expect(chromeStorage[storageKey]).toEqual(updated.rules);
  });

  it("deletes saved domain rules", async () => {
    const created = await saveDomainSwitcherRule(
      [],
      {
        onlineDomain: "www.example.com",
        localDomain: "localhost:5173"
      },
      null
    );

    const nextRules = await deleteDomainSwitcherRule(created.rules, created.savedRule.id);

    expect(nextRules).toEqual([]);
    expect(chromeStorage[storageKey]).toEqual([]);
  });
});
