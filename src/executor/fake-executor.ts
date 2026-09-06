import type { ExecutionResult } from "@/domain/execution";
import type { Executor } from "./executor";

export class FakeExecutor implements Executor {
  private readonly remaining: ExecutionResult[];

  constructor(results: ExecutionResult[]) {
    this.remaining = [...results];
  }

  remainingCount(): number {
    return this.remaining.length;
  }

  async execute<TInput, TOutput>(
    _code: string,
    _input: TInput,
  ): Promise<ExecutionResult<TOutput>> {
    const next = this.remaining.shift();
    if (!next) {
      throw new Error("FakeExecutor: no more scripted results");
    }
    return next as ExecutionResult<TOutput>;
  }
}
