export type WorkerRequest = {
  type: "execute";
  requestId: string;
  js: string;
  input: unknown;
};

export type WorkerResponse =
  | {
      type: "result";
      requestId: string;
      status: "success";
      output: unknown;
      executionTime: number;
    }
  | {
      type: "result";
      requestId: string;
      status: "runtime-error";
      error: string;
      executionTime?: number;
    };
