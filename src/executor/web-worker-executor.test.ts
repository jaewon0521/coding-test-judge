import { describe, expect, it, vi } from "vitest";
import type { CompileResult, Compiler } from "@/compiler/compiler";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";
import {
  WebWorkerExecutor,
  type WorkerEventType,
  type WorkerLike,
} from "./web-worker-executor";

class FakeCompiler implements Compiler {
  constructor(private readonly result: CompileResult) {}

  compile(_source: string): CompileResult {
    return this.result;
  }
}

class FakeWorker implements WorkerLike {
  readonly messageListeners = new Set<(event: Event) => void>();
  readonly errorListeners = new Set<(event: Event) => void>();
  readonly messageErrorListeners = new Set<(event: Event) => void>();
  terminated = false;
  lastRequest: WorkerRequest | undefined;

  constructor(
    private readonly respond: (
      request: WorkerRequest,
    ) => WorkerResponse | null | "defer",
  ) {}

  postMessage(message: unknown): void {
    const request = message as WorkerRequest;
    this.lastRequest = request;
    const response = this.respond(request);
    if (response === null || response === "defer") {
      return;
    }

    queueMicrotask(() => {
      this.emitMessage(response);
    });
  }

  emitMessage(response: WorkerResponse): void {
    if (this.terminated) {
      return;
    }
    for (const listener of this.messageListeners) {
      listener({ data: response } as MessageEvent);
    }
  }

  emitError(message: string): void {
    if (this.terminated) {
      return;
    }
    const event = { type: "error", message } as Event & { message: string };
    for (const listener of this.errorListeners) {
      listener(event);
    }
  }

  emitMessageError(): void {
    if (this.terminated) {
      return;
    }
    const event = new Event("messageerror");
    for (const listener of this.messageErrorListeners) {
      listener(event);
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(
    type: WorkerEventType,
    listener: (event: Event) => void,
  ): void {
    this.listenersFor(type).add(listener);
  }

  removeEventListener(
    type: WorkerEventType,
    listener: (event: Event) => void,
  ): void {
    this.listenersFor(type).delete(listener);
  }

  private listenersFor(type: WorkerEventType): Set<(event: Event) => void> {
    switch (type) {
      case "message":
        return this.messageListeners;
      case "error":
        return this.errorListeners;
      case "messageerror":
        return this.messageErrorListeners;
    }
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

  it("falls back when compile error message is empty", async () => {
    const executor = new WebWorkerExecutor(
      new FakeCompiler({ ok: false, error: "   " }),
      { createWorker: vi.fn() },
    );

    const result = await executor.execute("bad", 1);

    expect(result).toEqual({
      status: "compile-error",
      error: "Compile error",
    });
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
    expect(worker.messageListeners.size).toBe(0);
    expect(worker.errorListeners.size).toBe(0);
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
      new FakeCompiler({
        ok: true,
        js: "function solution() { throw new Error('boom'); }",
      }),
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
      new FakeCompiler({
        ok: true,
        js: "function solution() { while (true) {} }",
      }),
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

  it("keeps timeout when a late success arrives after settle", async () => {
    let worker!: FakeWorker;
    worker = new FakeWorker(() => "defer");
    const executor = new WebWorkerExecutor(
      new FakeCompiler({ ok: true, js: "function solution() { return 1; }" }),
      {
        timeoutMs: 20,
        createWorker: () => worker,
      },
    );

    const pending = executor.execute("code", null);
    await new Promise((resolve) => setTimeout(resolve, 25));
    worker.terminated = false;
    worker.emitMessage({
      type: "result",
      requestId: worker.lastRequest!.requestId,
      status: "success",
      output: 99,
      executionTime: 1,
    });

    await expect(pending).resolves.toEqual({
      status: "timeout",
      executionTime: 20,
    });
  });

  it("ignores duplicate messages after success", async () => {
    let worker!: FakeWorker;
    worker = new FakeWorker((request) => ({
      type: "result",
      requestId: request.requestId,
      status: "success",
      output: 1,
      executionTime: 1,
    }));
    const executor = new WebWorkerExecutor(
      new FakeCompiler({ ok: true, js: "function solution() { return 1; }" }),
      { createWorker: () => worker },
    );

    const result = await executor.execute("code", null);
    worker.terminated = false;
    worker.emitMessage({
      type: "result",
      requestId: worker.lastRequest!.requestId,
      status: "runtime-error",
      error: "should be ignored",
    });

    expect(result).toEqual({
      status: "success",
      output: 1,
      executionTime: 1,
    });
  });

  it("ignores mismatched requestId until the matching response arrives", async () => {
    let worker!: FakeWorker;
    worker = new FakeWorker(() => "defer");
    const executor = new WebWorkerExecutor(
      new FakeCompiler({ ok: true, js: "function solution() { return 7; }" }),
      {
        timeoutMs: 100,
        createWorker: () => worker,
      },
    );

    const pending = executor.execute("code", null);
    await Promise.resolve();

    worker.emitMessage({
      type: "result",
      requestId: "other-request",
      status: "success",
      output: 0,
      executionTime: 1,
    });
    worker.emitMessage({
      type: "result",
      requestId: worker.lastRequest!.requestId,
      status: "success",
      output: 7,
      executionTime: 4,
    });

    await expect(pending).resolves.toEqual({
      status: "success",
      output: 7,
      executionTime: 4,
    });
  });

  it("maps worker error events to runtime-error instead of waiting for timeout", async () => {
    let worker!: FakeWorker;
    worker = new FakeWorker(() => "defer");
    const executor = new WebWorkerExecutor(
      new FakeCompiler({ ok: true, js: "function solution() { return 1; }" }),
      {
        timeoutMs: 1000,
        createWorker: () => worker,
      },
    );

    const pending = executor.execute("code", null);
    await Promise.resolve();
    worker.emitError("Script error.");

    await expect(pending).resolves.toEqual({
      status: "runtime-error",
      error: "Script error.",
    });
    expect(worker.terminated).toBe(true);
  });

  it("maps messageerror events to runtime-error", async () => {
    let worker!: FakeWorker;
    worker = new FakeWorker(() => "defer");
    const executor = new WebWorkerExecutor(
      new FakeCompiler({ ok: true, js: "function solution() { return 1; }" }),
      {
        timeoutMs: 1000,
        createWorker: () => worker,
      },
    );

    const pending = executor.execute("code", null);
    await Promise.resolve();
    worker.emitMessageError();

    await expect(pending).resolves.toEqual({
      status: "runtime-error",
      error: "Worker message error",
    });
  });
});
