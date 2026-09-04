export interface TestCase<TInput = unknown, TOutput = unknown> {
  id: string;
  input: TInput;
  expected: TOutput;
}

export interface Problem<TInput = unknown, TOutput = unknown> {
  id: string;
  title: string;
  description: string;
  functionSignature: string;
  testCases: TestCase<TInput, TOutput>[];
}
