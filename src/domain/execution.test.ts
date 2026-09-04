import { describe, expect, it } from "vitest";
import type { ExecutionResult } from "./execution";

describe("ExecutionResult", () => {
  it("represents success with an output and no verdict", () => {
    const result: ExecutionResult<number> = {
      status: "success",
      output: 6,
      executionTime: 2,
    };

    expect(result.status).toBe("success");
    expect(result.output).toBe(6);
  });

  it("represents compile-error without running the code", () => {
    const result: ExecutionResult<number> = {
      status: "compile-error",
      error: "')' expected.",
    };

    expect(result.status).toBe("compile-error");
    expect(result.error).toBe("')' expected.");
  });

  it("represents runtime-error separately from compile-error", () => {
    const result: ExecutionResult<number> = {
      status: "runtime-error",
      error: "Cannot read properties of undefined",
      executionTime: 1,
    };

    expect(result.status).toBe("runtime-error");
  });

  it("represents timeout without treating it as a wrong answer", () => {
    const result: ExecutionResult<number> = {
      status: "timeout",
      executionTime: 1000,
    };

    expect(result.status).toBe("timeout");
  });
});
