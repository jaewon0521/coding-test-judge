import type { TestCase } from "@/domain/problem";

export function sampleTestCases<TInput, TOutput>(
  testCases: TestCase<TInput, TOutput>[],
): TestCase<TInput, TOutput>[] {
  return testCases.filter((testCase) => !testCase.hidden);
}
