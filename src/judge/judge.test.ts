import { describe, expect, it, vi } from "vitest";
import type { ExecutionResult } from "@/domain/execution";
import type { Comparator } from "./comparator";
import { ExactComparator } from "./exact-comparator";
import { Judge } from "./judge";

describe("Judge", () => {
  const judge = new Judge(new ExactComparator());

  it("passes when execution succeeds and output matches expected", () => {
    const execution: ExecutionResult<number> = {
      status: "success",
      output: 6,
      executionTime: 2,
    };

    const result = judge.judge(execution, 6);

    expect(result).toEqual({
      passed: true,
      actual: 6,
      expected: 6,
    });
  });

  it("fails when execution succeeds and output differs from expected", () => {
    const execution: ExecutionResult<number> = {
      status: "success",
      output: 8,
      executionTime: 3,
    };

    const result = judge.judge(execution, 10);

    expect(result).toEqual({
      passed: false,
      actual: 8,
      expected: 10,
    });
  });

  it("fails with error when execution has compile-error", () => {
    const execution: ExecutionResult<number> = {
      status: "compile-error",
      error: "')' expected.",
    };

    const result = judge.judge(execution, 6);

    expect(result).toEqual({
      passed: false,
      expected: 6,
      error: "')' expected.",
    });
  });

  it("fails with error when execution has runtime-error", () => {
    const execution: ExecutionResult<number> = {
      status: "runtime-error",
      error: "Cannot read properties of undefined",
      executionTime: 1,
    };

    const result = judge.judge(execution, 6);

    expect(result).toEqual({
      passed: false,
      expected: 6,
      error: "Cannot read properties of undefined",
    });
  });

  it("fails with error when execution times out", () => {
    const execution: ExecutionResult<number> = {
      status: "timeout",
      executionTime: 1000,
    };

    const result = judge.judge(execution, 6);

    expect(result).toEqual({
      passed: false,
      expected: 6,
      error: "Time limit exceeded",
    });
  });

  it("does not call comparator when execution fails", () => {
    const compare = vi.fn();
    const comparator: Comparator = { compare };
    const failingJudge = new Judge(comparator);

    const execution: ExecutionResult<number> = {
      status: "compile-error",
      error: "syntax error",
    };

    failingJudge.judge(execution, 6);

    expect(compare).not.toHaveBeenCalled();
  });
});
