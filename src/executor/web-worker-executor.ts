import type { ExecutionResult } from "@/domain/execution";
import type { Compiler } from "@/compiler/compiler";
import type { Executor } from "./executor";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
}

export type WebWorkerExecutorOptions = {
  timeoutMs?: number;
  createWorker?: () => WorkerLike;
};

export class WebWorkerExecutor implements Executor {
  private readonly timeoutMs: number;
  private readonly createWorker: () => WorkerLike;

  constructor(
    private readonly compiler: Compiler,
    options: WebWorkerExecutorOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 1000;
    this.createWorker =
      options.createWorker ??
      (() =>
        new Worker(new URL("./solution-worker.ts", import.meta.url), {
          type: "module",
        }) as unknown as WorkerLike);
  }

  async execute<TInput, TOutput>(
    code: string,
    input: TInput,
  ): Promise<ExecutionResult<TOutput>> {
    const compiled = this.compiler.compile(code);
    if (!compiled.ok) {
      return {
        status: "compile-error",
        error: compiled.error,
      };
    }

    const worker = this.createWorker();
    const requestId = crypto.randomUUID();

    return new Promise((resolve) => {
      let settled = false;

      const finish = (result: ExecutionResult<TOutput>) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        worker.terminate();
        resolve(result);
      };

      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;
        if (data.type !== "result" || data.requestId !== requestId) {
          return;
        }

        if (data.status === "success") {
          finish({
            status: "success",
            output: data.output as TOutput,
            executionTime: data.executionTime,
          });
          return;
        }

        finish({
          status: "runtime-error",
          error: data.error,
          executionTime: data.executionTime,
        });
      };

      const timer = setTimeout(() => {
        finish({
          status: "timeout",
          executionTime: this.timeoutMs,
        });
      }, this.timeoutMs);

      worker.addEventListener("message", onMessage);

      const request: WorkerRequest = {
        type: "execute",
        requestId,
        js: compiled.js,
        input,
      };
      worker.postMessage(request);
    });
  }
}
