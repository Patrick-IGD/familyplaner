import { describe, expect, it } from "vitest";
import { hashPin, isValidPin, newSessionToken, verifyPin } from "./crypto";

describe("identity/crypto", () => {
  it("hashes and verifies a valid PIN", () => {
    const hash = hashPin("1234");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verifyPin("1234", hash)).toBe(true);
    expect(verifyPin("5678", hash)).toBe(false);
  });

  it("produces a different hash for the same PIN (random salt)", () => {
    expect(hashPin("1234")).not.toEqual(hashPin("1234"));
  });

  it("rejects malformed stored hashes without crashing", () => {
    expect(verifyPin("1234", "garbage")).toBe(false);
    expect(verifyPin("1234", "")).toBe(false);
  });

  it("accepts only 4-6 digit PINs", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("")).toBe(false);
  });

  it("creates 64-char hex session tokens", () => {
    expect(newSessionToken()).toMatch(/^[0-9a-f]{64}$/);
    expect(newSessionToken()).not.toEqual(newSessionToken());
  });
});
