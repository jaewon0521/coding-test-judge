import { describe, expect, it } from "vitest";
import type { Problem, TestCase } from "./problem";

describe("Problem", () => {
  it("keeps test cases on the problem as static data", () => {
    const testCase: TestCase<number[], number> = {
      id: "1",
      input: [1, 2, 3],
      expected: 6,
    };

    const problem: Problem<number[], number> = {
      id: "sum-of-array",
      title: "Sum of Array",
      description: "Return the sum of all numbers in the array.",
      functionSignature: "function solution(numbers: number[]): number",
      testCases: [testCase],
    };

    expect(problem.testCases).toEqual([testCase]);
    expect(problem.testCases[0]?.expected).toBe(6);
  });
});
