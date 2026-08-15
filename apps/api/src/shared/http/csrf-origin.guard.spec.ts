import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { CsrfOriginGuard } from "./csrf-origin.guard";
import { apiEnv } from "../../bootstrap-env";

function contextFor(
  method: string,
  headers: Record<string, string | undefined> = {},
): ExecutionContext {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({ method, headers }),
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

describe("CsrfOriginGuard", () => {
  const trustedOrigin = new URL(apiEnv.APP_URL).origin;

  it("allows safe HTTP methods", () => {
    expect(
      new CsrfOriginGuard().canActivate(
        contextFor("GET", { origin: "https://attacker.example" }),
      ),
    ).toBe(true);
  });

  it("allows same-origin browser writes", () => {
    expect(
      new CsrfOriginGuard().canActivate(
        contextFor("POST", {
          cookie: "better-auth.session_token=test",
          origin: trustedOrigin,
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe(true);
  });

  it("allows same-origin Fetch Metadata when Origin is unavailable", () => {
    expect(
      new CsrfOriginGuard().canActivate(
        contextFor("PATCH", {
          cookie: "better-auth.session_token=test",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe(true);
  });

  it("rejects a cross-site Fetch Metadata request", () => {
    expect(() =>
      new CsrfOriginGuard().canActivate(
        contextFor("POST", { "sec-fetch-site": "cross-site" }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("rejects an untrusted Origin", () => {
    expect(() =>
      new CsrfOriginGuard().canActivate(
        contextFor("PATCH", { origin: "https://attacker.example" }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("rejects cookie-authenticated writes without browser provenance", () => {
    expect(() =>
      new CsrfOriginGuard().canActivate(
        contextFor("DELETE", { cookie: "better-auth.session_token=test" }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows service clients without browser cookies", () => {
    expect(
      new CsrfOriginGuard().canActivate(
        contextFor("DELETE", { authorization: "Bearer service-token" }),
      ),
    ).toBe(true);
  });
});
