import type { ExecutionResult } from "@/domain/execution";
import type { Compiler } from "@/compiler/compiler";
import { formatCompileError } from "@/compiler/compile-error";
import { formatRuntimeError } from "./error-message";
import type { Executor } from "./executor";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

export type WorkerEventType = "message" | "error" | "messageerror";

export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(
    type: WorkerEventType,
    listener: (event: Event) => void,
  ): void;
  removeEventListener(
    type: WorkerEventType,
    listener: (event: Event) => void,
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
        error: formatCompileError(compiled.error),
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
        worker.removeEventListener("error", onError);
        worker.removeEventListener("messageerror", onMessageError);
        worker.terminate();
        resolve(result);
      };

      const onMessage = (event: Event) => {
        const data = (event as MessageEvent<WorkerResponse>).data;
        if (
          !data ||
          data.type !== "result" ||
          data.requestId !== requestId ||
          settled
        ) {
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
          error: formatRuntimeError(data.error),
          executionTime: data.executionTime,
        });
      };

      const onError = (event: Event) => {
        if (settled) {
          return;
        }

        const record = event as Event & {
          message?: unknown;
          error?: unknown;
        };
        const message =
          typeof record.message === "string" && record.message.trim().length > 0
            ? record.message
            : record.error !== undefined
              ? record.error
              : event;

        finish({
          status: "runtime-error",
          error: formatRuntimeError(message),
        });
      };

      const onMessageError = () => {
        if (settled) {
          return;
        }

        finish({
          status: "runtime-error",
          error: "Worker message error",
        });
      };

      const timer = setTimeout(() => {
        finish({
          status: "timeout",
          executionTime: this.timeoutMs,
        });
      }, this.timeoutMs);

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.addEventListener("messageerror", onMessageError);

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
