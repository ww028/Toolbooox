import { describe, expect, it } from "vitest";
import {
  doesPageMatchCookieCaptureConfig,
  doesRequestMatchCookieCaptureUrl,
  getCookieHeaderFromRequestHeaders,
  parseCookieHeader
} from "./cookies";

describe("cookies helpers", () => {
  it("matches requests by origin and pathname while ignoring query strings", () => {
    expect(
      doesRequestMatchCookieCaptureUrl(
        "https://api.example.test/user/info?scene=refresh",
        "https://api.example.test/user/info"
      )
    ).toBe(true);
  });

  it("does not match different API paths", () => {
    expect(
      doesRequestMatchCookieCaptureUrl(
        "https://api.example.test/user/profile",
        "https://api.example.test/user/info"
      )
    ).toBe(false);
  });

  it("does not match different API domains", () => {
    expect(
      doesRequestMatchCookieCaptureUrl(
        "https://api.example.test/user/info",
        "https://other.example.test/user/info"
      )
    ).toBe(false);
  });

  it("matches capture config to the current page domain", () => {
    expect(
      doesPageMatchCookieCaptureConfig(
        "https://www.app.example.test/admin/",
        "app.example.test"
      )
    ).toBe(true);
  });

  it("does not match capture config from another page domain", () => {
    expect(
      doesPageMatchCookieCaptureConfig(
        "https://other.example.test/admin/",
        "app.example.test"
      )
    ).toBe(false);
  });

  it("extracts cookie request header case-insensitively", () => {
    expect(
      getCookieHeaderFromRequestHeaders([
        { name: "Accept", value: "application/json" },
        { name: "cookie", value: "sid=1; uid=2" }
      ])
    ).toBe("sid=1; uid=2");
  });

  it("parses captured cookie header into name value pairs", () => {
    expect(parseCookieHeader("sid=1; token=a=b=c; flag")).toEqual([
      { name: "sid", value: "1" },
      { name: "token", value: "a=b=c" },
      { name: "flag", value: "" }
    ]);
  });
});
