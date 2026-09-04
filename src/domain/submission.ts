export type SubmissionStatus =
  | "accepted"
  | "wrong-answer"
  | "compile-error"
  | "runtime-error"
  | "time-limit-exceeded";

export type TestResultStatus = "passed" | "failed";

export interface TestResult {
  testCaseId: string;
  status: TestResultStatus;
  actual?: unknown;
  expected?: unknown;
  executionTime?: number;
  error?: string;
}

export interface SubmissionResult {
  status: SubmissionStatus;
  passedCount: number;
  totalCount: number;
  testResults: TestResult[];
}
