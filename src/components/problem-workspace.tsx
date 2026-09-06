"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import type { SubmissionResult } from "@/domain/submission";
import { createBrowserGrader } from "@/grading/create-browser-grader";
import type { CatalogProblem } from "@/problems/catalog";
import { sampleTestCases } from "@/problems/sample-test-cases";
import { ActionBar } from "./action-bar";
import { TestResults } from "./test-results";

const CodeEditor = dynamic(
  () => import("./code-editor").then((mod) => mod.CodeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center border border-stone-300 bg-white text-sm text-stone-500">
        Loading editor…
      </div>
    ),
  },
);

type ProblemWorkspaceProps = {
  problem: CatalogProblem;
};

export function ProblemWorkspace({ problem }: ProblemWorkspaceProps) {
  const graderRef = useRef<ReturnType<typeof createBrowserGrader> | null>(null);
  const [code, setCode] = useState(problem.starterCode);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"run" | "submit" | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const sampleCases = useMemo(
    () => sampleTestCases(problem.testCases),
    [problem.testCases],
  );

  async function grade(nextMode: "run" | "submit") {
    if (busy) {
      return;
    }

    setBusy(true);
    setBanner(null);
    setMode(nextMode);

    try {
      if (!graderRef.current) {
        graderRef.current = createBrowserGrader();
      }

      const cases = nextMode === "run" ? sampleCases : problem.testCases;
      const nextResult = await graderRef.current.grade(code, cases);
      setResult(nextResult);
    } catch (error) {
      setResult(null);
      setBanner(
        error instanceof Error ? error.message : "Unexpected grading failure",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section className="overflow-auto border-b border-stone-300 px-5 py-4 lg:border-b-0 lg:border-r">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
            Problem
          </p>
          <h1 className="mb-3 text-2xl font-semibold text-stone-950">
            {problem.title}
          </h1>
          <pre className="mb-4 overflow-x-auto whitespace-pre-wrap font-sans text-sm leading-6 text-stone-700">
            {problem.description}
          </pre>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
            Signature
          </p>
          <code className="block rounded-sm bg-stone-100 px-3 py-2 font-mono text-xs text-stone-800">
            {problem.functionSignature}
          </code>
        </section>

        <section className="flex min-h-[320px] flex-col">
          <div className="border-b border-stone-300 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
            Editor
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor value={code} onChange={setCode} readOnly={busy} />
          </div>
        </section>
      </div>

      <ActionBar
        busy={busy}
        onRun={() => {
          void grade("run");
        }}
        onSubmit={() => {
          void grade("submit");
        }}
      />

      {banner ? (
        <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {banner}
        </p>
      ) : null}

      <TestResults result={result} mode={mode} />
    </div>
  );
}
