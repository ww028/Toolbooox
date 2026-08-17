import { describe, expect, it } from "vitest";
import { getPaginatedItems, getTotalPages } from "./pagination";
import { getHostname, normalizeUrl, isSameOrSubdomain } from "./urlMatcher";

describe("urlMatcher", () => {
  it("normalizes URLs and extracts comparable hostnames", () => {
    expect(normalizeUrl("example.com/path")).toBe("https://example.com/path");
    expect(normalizeUrl("https://www.example.com/path")).toBe("https://www.example.com/path");
    expect(getHostname("https://www.example.com/path")).toBe("example.com");
  });

  it("returns an empty hostname for invalid URLs", () => {
    expect(getHostname("not a valid url")).toBe("");
  });

  it("matches exact hosts and subdomains only", () => {
    expect(isSameOrSubdomain("app.example.com", "example.com")).toBe(true);
    expect(isSameOrSubdomain("example.com", "example.com")).toBe(true);
    expect(isSameOrSubdomain("badexample.com", "example.com")).toBe(false);
  });
});

describe("passwordVault pagination", () => {
  it("returns a stable page slice", () => {
    const items = Array.from({ length: 25 }, (_, index) => index + 1);

    expect(getPaginatedItems(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(getPaginatedItems(items, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });

  it("clamps invalid pagination input", () => {
    expect(getPaginatedItems([1, 2, 3], 0, 0)).toEqual([1]);
    expect(getTotalPages(0, 10)).toBe(1);
    expect(getTotalPages(21, 10)).toBe(3);
  });
});
