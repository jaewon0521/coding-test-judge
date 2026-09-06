import type { ExecutionResult } from "@/domain/execution";
import type { Comparator } from "./comparator";

export interface JudgeResult {
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  error?: string;
}

export class Judge {
  constructor(private readonly comparator: Comparator) {}

  judge<T>(execution: ExecutionResult<T>, expected: T): JudgeResult {
    if (execution.status !== "success") {
      return {
        passed: false,
        expected,
        error:
          execution.status === "timeout"
            ? "Time limit exceeded"
            : execution.error,
      };
    }

    const passed = this.comparator.compare(execution.output, expected);

    return {
      passed,
      actual: execution.output,
      expected,
    };
  }
}
