import type { CatalogProblem } from "./sum-of-array";

export const twoSum: CatalogProblem = {
  id: "two-sum",
  title: "Two Sum",
  description: `Given an array of integers and a target, return the indices of the two numbers that add up to the target.

Input: { nums: number[]; target: number }
Output: [index1, index2]
Constraints: exactly one solution exists; you may not use the same element twice.

Example:
- { nums: [2, 7, 11, 15], target: 9 } → [0, 1]`,
  functionSignature:
    "function solution(input: { nums: number[]; target: number }): number[]",
  starterCode: `function solution(input: { nums: number[]; target: number }): number[] {
  const { nums, target } = input;
  // Write your code here
  return [0, 1];
}
`,
  testCases: [
    {
      id: "1",
      input: { nums: [2, 7, 11, 15], target: 9 },
      expected: [0, 1],
    },
    {
      id: "2",
      input: { nums: [3, 2, 4], target: 6 },
      expected: [1, 2],
    },
    {
      id: "3",
      input: { nums: [3, 3], target: 6 },
      expected: [0, 1],
      hidden: true,
    },
  ],
};
