export interface TestCase<TInput = unknown, TOutput = unknown> {
  id: string;
  input: TInput;
  expected: TOutput;
  /** When true, the case is used for Submit only (not Run samples). */
  hidden?: boolean;
}

export interface Problem<TInput = unknown, TOutput = unknown> {
  id: string;
  title: string;
  description: string;
  functionSignature: string;
  testCases: TestCase<TInput, TOutput>[];
}
