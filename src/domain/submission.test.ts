import { describe, expect, it } from "vitest";
import type { SubmissionResult, TestResult } from "./submission";

describe("SubmissionResult", () => {
  it("aggregates per-test results into accepted when all tests pass", () => {
    const testResults: TestResult[] = [
      {
        testCaseId: "1",
        status: "passed",
        actual: 6,
        expected: 6,
        executionTime: 2,
      },
      {
        testCaseId: "2",
        status: "passed",
        actual: 0,
        expected: 0,
        executionTime: 1,
      },
    ];

    const result: SubmissionResult = {
      status: "accepted",
      passedCount: 2,
      totalCount: 2,
      testResults,
    };

    expect(result.status).toBe("accepted");
    expect(result.passedCount).toBe(result.totalCount);
  });

  it("keeps wrong-answer distinct from execution failures", () => {
    const result: SubmissionResult = {
      status: "wrong-answer",
      passedCount: 2,
      totalCount: 3,
      testResults: [
        { testCaseId: "1", status: "passed", actual: 6, expected: 6 },
        { testCaseId: "2", status: "passed", actual: 0, expected: 0 },
        { testCaseId: "3", status: "failed", actual: 8, expected: 10 },
      ],
    };

    expect(result.status).toBe("wrong-answer");
    expect(result.testResults[2]?.status).toBe("failed");
  });

  it("uses time-limit-exceeded for timeout submissions", () => {
    const result: SubmissionResult = {
      status: "time-limit-exceeded",
      passedCount: 0,
      totalCount: 1,
      testResults: [
        {
          testCaseId: "1",
          status: "failed",
          error: "Time Limit Exceeded",
        },
      ],
    };

    expect(result.status).toBe("time-limit-exceeded");
  });

  it("keeps compile-error distinct from wrong-answer", () => {
    const result: SubmissionResult = {
      status: "compile-error",
      passedCount: 0,
      totalCount: 1,
      testResults: [
        {
          testCaseId: "1",
          status: "failed",
          error: "Compile Error",
        },
      ],
    };

    expect(result.status).toBe("compile-error");
  });

  it("keeps runtime-error distinct from compile-error", () => {
    const result: SubmissionResult = {
      status: "runtime-error",
      passedCount: 0,
      totalCount: 1,
      testResults: [
        {
          testCaseId: "1",
          status: "failed",
          error: "Runtime Error",
        },
      ],
    };

    expect(result.status).toBe("runtime-error");
  });
});
