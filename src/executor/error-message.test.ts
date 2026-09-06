import { describe, expect, it } from "vitest";
import { formatRuntimeError } from "./error-message";

describe("formatRuntimeError", () => {
  it("formats Error.message for runtime errors", () => {
    expect(formatRuntimeError(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error runtime values", () => {
    expect(formatRuntimeError("plain failure")).toBe("plain failure");
    expect(formatRuntimeError(404)).toBe("404");
  });

  it("falls back when runtime message is empty", () => {
    expect(formatRuntimeError(new Error("   "))).toBe("Runtime error");
    expect(formatRuntimeError("")).toBe("Runtime error");
    expect(formatRuntimeError(undefined)).toBe("Runtime error");
  });

  it("does not include stack traces in the message", () => {
    const error = new Error("boom");
    error.stack = "Error: boom\n    at solution (user.js:1:1)";
    expect(formatRuntimeError(error)).toBe("boom");
    expect(formatRuntimeError(error)).not.toContain("user.js");
  });
});
