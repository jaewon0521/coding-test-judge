import type { Problem } from "@/domain/problem";

export type CatalogProblem = Problem & {
  starterCode: string;
};

export const sumOfArray: CatalogProblem = {
  id: "sum-of-array",
  title: "Sum of Array",
  description: `Return the sum of all numbers in the array.

Input: number[]
Output: number
Constraints: 0 <= numbers.length <= 1000

Example:
- input [1, 2, 3] → 6
- input [] → 0`,
  functionSignature: "function solution(numbers: number[]): number",
  starterCode: `function solution(numbers: number[]): number {
  // Write your code here
  return 0;
}
`,
  testCases: [
    { id: "1", input: [1, 2, 3], expected: 6 },
    { id: "2", input: [], expected: 0 },
    { id: "3", input: [-2, 5, 7], expected: 10, hidden: true },
    { id: "4", input: [100], expected: 100, hidden: true },
  ],
};
