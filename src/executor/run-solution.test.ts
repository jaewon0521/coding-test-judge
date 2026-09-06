import { describe, expect, it } from "vitest";
import { runSolution } from "./run-solution";

describe("runSolution", () => {
  it("returns the value from solution", () => {
    const js = `
      function solution(numbers) {
        return numbers.reduce((sum, n) => sum + n, 0);
      }
    `;

    expect(runSolution(js, [1, 2, 3])).toBe(6);
  });

  it("throws when solution is missing", () => {
    expect(() => runSolution("const x = 1;", 1)).toThrow(
      /solution is not defined/,
    );
  });

  it("rethrows runtime errors from solution", () => {
    const js = `
      function solution() {
        throw new Error("boom");
      }
    `;

    expect(() => runSolution(js, null)).toThrow("boom");
  });
});
