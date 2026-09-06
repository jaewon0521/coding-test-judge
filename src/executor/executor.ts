import type { ExecutionResult } from "@/domain/execution";

export interface Executor {
  execute<TInput, TOutput>(
    code: string,
    input: TInput,
  ): Promise<ExecutionResult<TOutput>>;
}
