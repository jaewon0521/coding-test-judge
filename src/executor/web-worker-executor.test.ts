import { describe, expect, it, vi } from "vitest";
import type { CompileResult, Compiler } from "@/compiler/compiler";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";
import {
  WebWorkerExecutor,
  type WorkerLike,
} from "./web-worker-executor";

class FakeCompiler implements Compiler {
  constructor(private readonly result: CompileResult) {}

  compile(_source: string): CompileResult {
    return this.result;
  }
}

class FakeWorker implements WorkerLike {
  readonly listeners = new Set<(event: MessageEvent) => void>();
  terminated = false;
  lastRequest: WorkerRequest | undefined;

  constructor(
    private readonly respond: (request: WorkerRequest) => WorkerResponse | null,
  ) {}

  postMessage(message: unknown): void {
    const request = message as WorkerRequest;
    this.lastRequest = request;
    const response = this.respond(request);
    if (response === null) {
      return;
    }

    queueMicrotask(() => {
      if (this.terminated) {
        return;
      }
      for (const listener of this.listeners) {
        listener({ data: response } as MessageEvent);
      }
    });
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent) => void,
  ): void {
    this.listeners.delete(listener);
  }
}

describe("WebWorkerExecutor", () => {
  it("returns compile-error without creating a worker", async () => {
    const createWorker = vi.fn();
    const executor = new WebWorkerExecutor(
      new FakeCompiler({ ok: false, error: "')' expected." }),
      { createWorker },
    );

    const result = await executor.execute("bad", 1);

    expect(result).toEqual({
      status: "compile-error",
      error: "')' expected.",
    });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("maps a successful worker response to success", async () => {
    const worker = new FakeWorker((request) => ({
      type: "result",
      requestId: request.requestId,
      status: "success",
      output: 42,
      executionTime: 3,
    }));
    const executor = new WebWorkerExecutor(
      new FakeCompiler({ ok: true, js: "function solution(n) { return n; }" }),
      { createWorker: () => worker },
    );

    const result = await executor.execute("code", 41);

    expect(result).toEqual({
      status: "success",
      output: 42,
      executionTime: 3,
    });
    expect(worker.lastRequest?.input).toBe(41);
    expect(worker.terminated).toBe(true);
  });

  it("maps a worker runtime failure to runtime-error", async () => {
    const worker = new FakeWorker((request) => ({
      type: "result",
      requestId: request.requestId,
      status: "runtime-error",
      error: "boom",
      executionTime: 2,
    }));
    const executor = new WebWorkerExecutor(
      new FakeCompiler({ ok: true, js: "function solution() { throw new Error('boom'); }" }),
      { createWorker: () => worker },
    );

    const result = await executor.execute("code", null);

    expect(result).toEqual({
      status: "runtime-error",
      error: "boom",
      executionTime: 2,
    });
  });

  it("terminates the worker and returns timeout when no response arrives", async () => {
    const worker = new FakeWorker(() => null);
    const executor = new WebWorkerExecutor(
      new FakeCompiler({ ok: true, js: "function solution() { while (true) {} }" }),
      {
        timeoutMs: 20,
        createWorker: () => worker,
      },
    );

    const result = await executor.execute("code", null);

    expect(result).toEqual({
      status: "timeout",
      executionTime: 20,
    });
    expect(worker.terminated).toBe(true);
  });
});
