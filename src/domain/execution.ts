export type ExecutionStatus =
  | "success"
  | "compile-error"
  | "runtime-error"
  | "timeout";

export type ExecutionResult<T = unknown> =
  | {
      status: "success";
      output: T;
      executionTime: number;
    }
  | {
      status: "compile-error";
      error: string;
    }
  | {
      status: "runtime-error";
      error: string;
      executionTime?: number;
    }
  | {
      status: "timeout";
      executionTime: number;
    };
