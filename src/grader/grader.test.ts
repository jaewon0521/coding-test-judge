import { describe, expect, it } from "vitest";
import type { TestCase } from "@/domain/problem";
import { FakeExecutor } from "@/executor/fake-executor";
import { ExactComparator } from "@/judge/exact-comparator";
import { Judge } from "@/judge/judge";
import { Grader } from "./grader";

const testCases: TestCase<number[], number>[] = [
  { id: "1", input: [1, 2, 3], expected: 6 },
  { id: "2", input: [4, 5], expected: 9 },
  { id: "3", input: [], expected: 0 },
];

function createGrader(executor: FakeExecutor): Grader {
  return new Grader(executor, new Judge(new ExactComparator()));
}

describe("Grader", () => {
  it("returns accepted when every test passes", async () => {
    const executor = new FakeExecutor([
      { status: "success", output: 6, executionTime: 1 },
      { status: "success", output: 9, executionTime: 2 },
      { status: "success", output: 0, executionTime: 1 },
    ]);
    const grader = createGrader(executor);

    const result = await grader.grade("code", testCases);

    expect(result.status).toBe("accepted");
    expect(result.passedCount).toBe(3);
    expect(result.totalCount).toBe(3);
    expect(result.testResults).toEqual([
      {
        testCaseId: "1",
        status: "passed",
        actual: 6,
        expected: 6,
        executionTime: 1,
      },
      {
        testCaseId: "2",
        status: "passed",
        actual: 9,
        expected: 9,
        executionTime: 2,
      },
      {
        testCaseId: "3",
        status: "passed",
        actual: 0,
        expected: 0,
        executionTime: 1,
      },
    ]);
  });

  it("returns wrong-answer when some outputs differ", async () => {
    const executor = new FakeExecutor([
      { status: "success", output: 6, executionTime: 1 },
      { status: "success", output: 8, executionTime: 2 },
      { status: "success", output: 0, executionTime: 1 },
    ]);
    const grader = createGrader(executor);

    const result = await grader.grade("code", testCases);

    expect(result.status).toBe("wrong-answer");
    expect(result.passedCount).toBe(2);
    expect(result.totalCount).toBe(3);
    expect(result.testResults.map((item) => item.status)).toEqual([
      "passed",
      "failed",
      "passed",
    ]);
    expect(result.testResults[1]).toMatchObject({
      testCaseId: "2",
      status: "failed",
      actual: 8,
      expected: 9,
      executionTime: 2,
    });
  });

  it("stops after compile-error and keeps remaining cases unexecuted", async () => {
    const executor = new FakeExecutor([
      { status: "compile-error", error: "')' expected." },
      { status: "success", output: 9, executionTime: 1 },
      { status: "success", output: 0, executionTime: 1 },
    ]);
    const grader = createGrader(executor);

    const result = await grader.grade("code", testCases);

    expect(result.status).toBe("compile-error");
    expect(result.passedCount).toBe(0);
    expect(result.totalCount).toBe(3);
    expect(result.testResults).toHaveLength(1);
    expect(result.testResults[0]).toMatchObject({
      testCaseId: "1",
      status: "failed",
      expected: 6,
      error: "')' expected.",
    });
    expect(executor.remainingCount()).toBe(2);
  });

  it("continues after runtime-error and reports runtime-error status", async () => {
    const executor = new FakeExecutor([
      { status: "success", output: 6, executionTime: 1 },
      {
        status: "runtime-error",
        error: "Cannot read properties of undefined",
        executionTime: 2,
      },
      { status: "success", output: 0, executionTime: 1 },
    ]);
    const grader = createGrader(executor);

    const result = await grader.grade("code", testCases);

    expect(result.status).toBe("runtime-error");
    expect(result.passedCount).toBe(2);
    expect(result.totalCount).toBe(3);
    expect(result.testResults).toHaveLength(3);
    expect(result.testResults[1]).toMatchObject({
      testCaseId: "2",
      status: "failed",
      expected: 9,
      error: "Cannot read properties of undefined",
      executionTime: 2,
    });
    expect(result.testResults[2]?.status).toBe("passed");
  });

  it("continues after timeout and reports time-limit-exceeded", async () => {
    const executor = new FakeExecutor([
      { status: "success", output: 6, executionTime: 1 },
      { status: "timeout", executionTime: 1000 },
      { status: "success", output: 0, executionTime: 1 },
    ]);
    const grader = createGrader(executor);

    const result = await grader.grade("code", testCases);

    expect(result.status).toBe("time-limit-exceeded");
    expect(result.passedCount).toBe(2);
    expect(result.totalCount).toBe(3);
    expect(result.testResults).toHaveLength(3);
    expect(result.testResults[1]).toMatchObject({
      testCaseId: "2",
      status: "failed",
      expected: 9,
      executionTime: 1000,
    });
  });

  it("prefers runtime-error over wrong-answer when both occur", async () => {
    const executor = new FakeExecutor([
      { status: "success", output: 7, executionTime: 1 },
      {
        status: "runtime-error",
        error: "boom",
        executionTime: 1,
      },
      { status: "success", output: 0, executionTime: 1 },
    ]);
    const grader = createGrader(executor);

    const result = await grader.grade("code", testCases);

    expect(result.status).toBe("runtime-error");
    expect(result.passedCount).toBe(1);
  });

  it("prefers time-limit-exceeded over wrong-answer when both occur", async () => {
    const executor = new FakeExecutor([
      { status: "success", output: 7, executionTime: 1 },
      { status: "timeout", executionTime: 1000 },
      { status: "success", output: 0, executionTime: 1 },
    ]);
    const grader = createGrader(executor);

    const result = await grader.grade("code", testCases);

    expect(result.status).toBe("time-limit-exceeded");
    expect(result.passedCount).toBe(1);
  });

  it("returns accepted with zero counts for empty test cases", async () => {
    const executor = new FakeExecutor([]);
    const grader = createGrader(executor);

    const result = await grader.grade("code", []);

    expect(result).toEqual({
      status: "accepted",
      passedCount: 0,
      totalCount: 0,
      testResults: [],
    });
  });

  it("depends on the Executor interface so FakeExecutor can drive scenarios", async () => {
    const accepted = createGrader(
      new FakeExecutor([{ status: "success", output: 6, executionTime: 1 }]),
    );
    const compileFailed = createGrader(
      new FakeExecutor([{ status: "compile-error", error: "bad syntax" }]),
    );
    const singleCase = [testCases[0]!];

    await expect(accepted.grade("a", singleCase)).resolves.toMatchObject({
      status: "accepted",
    });
    await expect(compileFailed.grade("b", singleCase)).resolves.toMatchObject({
      status: "compile-error",
    });
  });
});
