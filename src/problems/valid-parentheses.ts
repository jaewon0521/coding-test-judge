import type { CatalogProblem } from "./sum-of-array";

export const validParentheses: CatalogProblem = {
  id: "valid-parentheses",
  title: "Valid Parentheses",
  description: `Given a string containing only '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

A string is valid when brackets are closed by the same type in the correct order.

Input: string
Output: boolean

Example:
- "()" → true
- "([)]" → false`,
  functionSignature: "function solution(s: string): boolean",
  starterCode: `function solution(s: string): boolean {
  // Write your code here
  return false;
}
`,
  testCases: [
    { id: "1", input: "()", expected: true },
    { id: "2", input: "()[]{}", expected: true },
    { id: "3", input: "(]", expected: false },
    { id: "4", input: "([)]", expected: false, hidden: true },
    { id: "5", input: "{[]}", expected: true, hidden: true },
  ],
};
