import type { ExecutionResult } from "@/domain/execution";
import type { TestCase } from "@/domain/problem";
import type {
  SubmissionResult,
  SubmissionStatus,
  TestResult,
} from "@/domain/submission";
import type { Executor } from "@/executor/executor";
import type { Judge, JudgeResult } from "@/judge/judge";

export class Grader {
  constructor(
    private readonly executor: Executor,
    private readonly judge: Judge,
  ) {}

  async grade(
    code: string,
    testCases: TestCase[],
  ): Promise<SubmissionResult> {
    const testResults: TestResult[] = [];
    let outcome: SubmissionStatus = "accepted";

    for (const testCase of testCases) {
      const execution = await this.executor.execute(code, testCase.input);
      const judgment = this.judge.judge(execution, testCase.expected);
      testResults.push(toTestResult(testCase, execution, judgment));
      outcome = mergeOutcome(outcome, toCaseStatus(execution, judgment));

      if (execution.status === "compile-error") {
        break;
      }
    }

    return {
      status: outcome,
      passedCount: testResults.filter((result) => result.status === "passed")
        .length,
      totalCount: testCases.length,
      testResults,
    };
  }
}

type CaseStatus = SubmissionStatus | "passed";

function toCaseStatus(
  execution: ExecutionResult,
  judgment: JudgeResult,
): CaseStatus {
  switch (execution.status) {
    case "compile-error":
      return "compile-error";
    case "runtime-error":
      return "runtime-error";
    case "timeout":
      return "time-limit-exceeded";
    case "success":
      return judgment.passed ? "passed" : "wrong-answer";
  }
}

function mergeOutcome(
  current: SubmissionStatus,
  next: CaseStatus,
): SubmissionStatus {
  if (next === "passed") {
    return current;
  }

  const priority: Record<SubmissionStatus, number> = {
    "compile-error": 4,
    "runtime-error": 3,
    "time-limit-exceeded": 2,
    "wrong-answer": 1,
    accepted: 0,
  };

  return priority[next] >= priority[current] ? next : current;
}

function toTestResult(
  testCase: TestCase,
  execution: ExecutionResult,
  judgment: JudgeResult,
): TestResult {
  const result: TestResult = {
    testCaseId: testCase.id,
    status: judgment.passed ? "passed" : "failed",
    expected: testCase.expected,
  };

  if (judgment.actual !== undefined) {
    result.actual = judgment.actual;
  }

  if (judgment.error !== undefined) {
    result.error = judgment.error;
  }

  if (execution.status === "success" || execution.status === "timeout") {
    result.executionTime = execution.executionTime;
  } else if (
    execution.status === "runtime-error" &&
    execution.executionTime !== undefined
  ) {
    result.executionTime = execution.executionTime;
  }

  return result;
}
