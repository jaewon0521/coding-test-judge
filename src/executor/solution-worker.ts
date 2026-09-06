/// <reference lib="webworker" />

import { runSolution } from "./run-solution";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type !== "execute") {
    return;
  }

  const startedAt = performance.now();

  try {
    const output = runSolution(message.js, message.input);
    const response: WorkerResponse = {
      type: "result",
      requestId: message.requestId,
      status: "success",
      output,
      executionTime: performance.now() - startedAt,
    };
    workerScope.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      type: "result",
      requestId: message.requestId,
      status: "runtime-error",
      error: error instanceof Error ? error.message : String(error),
      executionTime: performance.now() - startedAt,
    };
    workerScope.postMessage(response);
  }
};
