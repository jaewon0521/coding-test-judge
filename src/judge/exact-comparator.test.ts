import { describe, expect, it } from "vitest";
import { ExactComparator } from "./exact-comparator";

describe("ExactComparator", () => {
  const comparator = new ExactComparator();

  it("returns true for identical primitives", () => {
    expect(comparator.compare(6, 6)).toBe(true);
    expect(comparator.compare("ok", "ok")).toBe(true);
    expect(comparator.compare(true, true)).toBe(true);
    expect(comparator.compare(null, null)).toBe(true);
  });

  it("returns false for different primitives", () => {
    expect(comparator.compare(6, 7)).toBe(false);
    expect(comparator.compare("ok", "no")).toBe(false);
    expect(comparator.compare(true, false)).toBe(false);
    expect(comparator.compare(null, 0)).toBe(false);
  });

  it("compares arrays by value and order", () => {
    expect(comparator.compare([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(comparator.compare([1, 2, 3], [3, 2, 1])).toBe(false);
    expect(comparator.compare([1, 2], [1, 2, 3])).toBe(false);
  });

  it("compares nested arrays and plain objects by value", () => {
    expect(
      comparator.compare(
        { a: [1, { b: 2 }], c: "x" },
        { a: [1, { b: 2 }], c: "x" },
      ),
    ).toBe(true);

    expect(
      comparator.compare(
        { a: [1, { b: 2 }], c: "x" },
        { a: [1, { b: 3 }], c: "x" },
      ),
    ).toBe(false);

    expect(comparator.compare({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("returns true for equal values with different references", () => {
    expect(comparator.compare({ n: 1 }, { n: 1 })).toBe(true);
    expect(comparator.compare([1, 2], [1, 2])).toBe(true);
  });

  it("returns false when undefined is compared to a defined value", () => {
    expect(comparator.compare(undefined, 1)).toBe(false);
    expect(comparator.compare(1, undefined)).toBe(false);
  });

  it("returns false for empty array versus empty object", () => {
    expect(comparator.compare([], {})).toBe(false);
  });
});
