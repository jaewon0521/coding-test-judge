import { describe, expect, it } from "vitest";
import { formatCompileError } from "./compile-error";

describe("formatCompileError", () => {
  it("keeps non-empty compile messages", () => {
    expect(formatCompileError("')' expected.")).toBe("')' expected.");
  });

  it("falls back when the message is blank", () => {
    expect(formatCompileError("  ")).toBe("Compile error");
  });
});
