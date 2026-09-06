import type { Comparator } from "./comparator";

export class ExactComparator implements Comparator {
  compare(actual: unknown, expected: unknown): boolean {
    return deepEqual(actual, expected);
  }
}

function deepEqual(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) {
    return true;
  }

  if (
    typeof actual !== "object" ||
    actual === null ||
    typeof expected !== "object" ||
    expected === null
  ) {
    return false;
  }

  if (Array.isArray(actual) !== Array.isArray(expected)) {
    return false;
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      return false;
    }

    return actual.every((value, index) => deepEqual(value, expected[index]));
  }

  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);

  if (actualKeys.length !== expectedKeys.length) {
    return false;
  }

  const expectedRecord = expected as Record<string, unknown>;
  const actualRecord = actual as Record<string, unknown>;

  return actualKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(expectedRecord, key) &&
      deepEqual(actualRecord[key], expectedRecord[key]),
  );
}
