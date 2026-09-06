import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SubmissionResult } from "@/domain/submission";
import { TestResults } from "./test-results";

describe("TestResults", () => {
  it("renders accepted status and per-case rows", () => {
    const result: SubmissionResult = {
      status: "accepted",
      passedCount: 2,
      totalCount: 2,
      testResults: [
        {
          testCaseId: "1",
          status: "passed",
          expected: 1,
          actual: 1,
          executionTime: 2,
        },
        {
          testCaseId: "2",
          status: "passed",
          expected: 2,
          actual: 2,
          executionTime: 3,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <TestResults result={result} mode="submit" />,
    );

    expect(html).toContain("Accepted");
    expect(html).toContain("2 / 2 passed");
    expect(html).toContain("Test 1");
    expect(html).toContain("Test 2");
  });

  it("shows expected and actual for failed cases", () => {
    const result: SubmissionResult = {
      status: "wrong-answer",
      passedCount: 0,
      totalCount: 1,
      testResults: [
        {
          testCaseId: "1",
          status: "failed",
          expected: 6,
          actual: 5,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <TestResults result={result} mode="run" />,
    );

    expect(html).toContain("Wrong Answer");
    expect(html).toContain("Expected: 6");
    expect(html).toContain("Actual: 5");
  });

  it("shows not-run placeholders when grading stops early", () => {
    const result: SubmissionResult = {
      status: "compile-error",
      passedCount: 0,
      totalCount: 3,
      testResults: [
        {
          testCaseId: "1",
          status: "failed",
          error: "')' expected.",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <TestResults result={result} mode="submit" />,
    );

    expect(html).toContain("Compile Error");
    expect(html).toContain("Not run");
  });
});
