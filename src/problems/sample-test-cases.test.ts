import { describe, expect, it } from "vitest";
import type { TestCase } from "@/domain/problem";
import { sampleTestCases } from "./sample-test-cases";

describe("sampleTestCases", () => {
  it("excludes hidden cases used only for submit", () => {
    const cases: TestCase<number, number>[] = [
      { id: "1", input: 1, expected: 1 },
      { id: "2", input: 2, expected: 2, hidden: true },
    ];

    expect(sampleTestCases(cases)).toEqual([
      { id: "1", input: 1, expected: 1 },
    ]);
  });
});
