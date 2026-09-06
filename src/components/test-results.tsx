import type { SubmissionResult, SubmissionStatus } from "@/domain/submission";

type TestResultsProps = {
  result: SubmissionResult | null;
  mode: "run" | "submit" | null;
};

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  accepted: "Accepted",
  "wrong-answer": "Wrong Answer",
  "compile-error": "Compile Error",
  "runtime-error": "Runtime Error",
  "time-limit-exceeded": "Time Limit Exceeded",
};

export function TestResults({ result, mode }: TestResultsProps) {
  if (!result) {
    return (
      <section className="border-t border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600">
        Run or Submit to see results.
      </section>
    );
  }

  const heading =
    mode === "run" && result.status === "accepted"
      ? "Sample cases passed"
      : STATUS_LABEL[result.status];

  return (
    <section className="border-t border-stone-300 bg-stone-50 px-4 py-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-stone-900">
          {heading}
        </h2>
        <p className="text-sm text-stone-600">
          {result.passedCount} / {result.totalCount} passed
          {mode === "run" ? " (samples)" : ""}
        </p>
      </div>

      <ul className="space-y-2 font-mono text-xs text-stone-800">
        {result.testResults.map((testResult) => (
          <li
            key={testResult.testCaseId}
            className="border border-stone-200 bg-white px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span>
                {testResult.status === "passed" ? "✓" : "✕"} Test{" "}
                {testResult.testCaseId}
              </span>
              {testResult.executionTime !== undefined ? (
                <span className="text-stone-500">
                  {Math.round(testResult.executionTime)}ms
                </span>
              ) : null}
            </div>
            {testResult.status === "failed" ? (
              <div className="mt-1 space-y-0.5 text-stone-600">
                {testResult.error ? <p>Error: {testResult.error}</p> : null}
                {testResult.expected !== undefined ? (
                  <p>Expected: {stringify(testResult.expected)}</p>
                ) : null}
                {testResult.actual !== undefined ? (
                  <p>Actual: {stringify(testResult.actual)}</p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
        {result.testResults.length < result.totalCount
          ? Array.from(
              { length: result.totalCount - result.testResults.length },
              (_, index) => (
                <li
                  key={`not-run-${index}`}
                  className="border border-dashed border-stone-200 bg-white px-3 py-2 text-stone-500"
                >
                  – Not run
                </li>
              ),
            )
          : null}
      </ul>
    </section>
  );
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
