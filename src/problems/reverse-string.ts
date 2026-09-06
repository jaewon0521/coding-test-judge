import type { CatalogProblem } from "./sum-of-array";

export const reverseString: CatalogProblem = {
  id: "reverse-string",
  title: "Reverse String",
  description: `Reverse the given string and return it.

Input: string
Output: string

Example:
- "hello" → "olleh"
- "" → ""`,
  functionSignature: "function solution(text: string): string",
  starterCode: `function solution(text: string): string {
  // Write your code here
  return text;
}
`,
  testCases: [
    { id: "1", input: "hello", expected: "olleh" },
    { id: "2", input: "", expected: "" },
    { id: "3", input: "a", expected: "a", hidden: true },
    { id: "4", input: "TypeScript", expected: "tpircSepyT", hidden: true },
  ],
};
