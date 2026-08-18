import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  buildSwitchedDomainUrl,
  deleteDomainSwitcherRule,
  getDomainSwitcherRules,
  saveDomainSwitcherRule
} from "./domainSwitcher";

const keyValueDatabaseName = "toolbooox.keyValue";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

describe("domainSwitcher", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal("indexedDB", new IDBFactory());
    await requestToPromise(indexedDB.deleteDatabase(keyValueDatabaseName));
  });

  it("switches from online domain to local development domain", () => {
    expect(
      buildSwitchedDomainUrl("https://www.example.test/users?id=1#profile", {
        onlineDomain: "www.example.test",
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
        onlineDomain: "www.example.test",
        localDomain: "localhost:5173"
      })
    ).toEqual({
      nextUrl: "https://www.example.test/users?id=1#profile",
      source: "local"
    });
  });

  it("keeps explicit target protocol when provided", () => {
    expect(
      buildSwitchedDomainUrl("https://www.example.test/dashboard", {
        onlineDomain: "https://www.example.test",
        localDomain: "http://dev.example.test:3000"
      })
    ).toEqual({
      nextUrl: "http://dev.example.test:3000/dashboard",
      source: "online"
    });
  });

  it("returns null when the current URL does not match either domain", () => {
    expect(
      buildSwitchedDomainUrl("https://other.example.test/dashboard", {
        onlineDomain: "www.example.test",
        localDomain: "localhost:5173"
      })
    ).toBeNull();
  });

  it("returns null for invalid configuration", () => {
    expect(
      buildSwitchedDomainUrl("https://www.example.test/dashboard", {
        onlineDomain: "",
        localDomain: "localhost:5173"
      })
    ).toBeNull();
  });

  it("creates and updates saved domain rules", async () => {
    const created = await saveDomainSwitcherRule(
      [],
      {
        onlineDomain: "www.example.test",
        localDomain: "localhost:5173"
      },
      null
    );
    const updated = await saveDomainSwitcherRule(
      created.rules,
      {
        onlineDomain: "admin.example.test",
        localDomain: "localhost:3000"
      },
      created.savedRule.id
    );

    expect(updated.rules).toHaveLength(1);
    expect(updated.savedRule.id).toBe(created.savedRule.id);
    expect(updated.savedRule).toMatchObject({
      onlineDomain: "admin.example.test",
      localDomain: "localhost:3000"
    });
    expect(await getDomainSwitcherRules()).toEqual(updated.rules);
  });

  it("deletes saved domain rules", async () => {
    const created = await saveDomainSwitcherRule(
      [],
      {
        onlineDomain: "www.example.test",
        localDomain: "localhost:5173"
      },
      null
    );

    const nextRules = await deleteDomainSwitcherRule(created.rules, created.savedRule.id);

    expect(nextRules).toEqual([]);
    expect(await getDomainSwitcherRules()).toEqual([]);
  });
});
