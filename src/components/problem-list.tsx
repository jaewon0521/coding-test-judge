import Link from "next/link";
import { listProblems } from "@/problems/catalog";

export function ProblemList() {
  const problems = listProblems();

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-10">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
        Browser Coding Test Judge
      </p>
      <h1 className="mb-2 text-3xl font-semibold text-stone-950">Problems</h1>
      <p className="mb-8 max-w-2xl text-sm leading-6 text-stone-600">
        Pick a problem, write TypeScript in the browser, then Run sample cases
        or Submit all cases. Grading happens locally — no server execution.
      </p>

      <ol className="divide-y divide-stone-200 border-y border-stone-200">
        {problems.map((problem, index) => (
          <li key={problem.id}>
            <Link
              href={`/problems/${problem.id}`}
              className="flex items-baseline justify-between gap-4 py-4 text-stone-900 transition-colors hover:text-stone-600"
            >
              <span className="font-medium">
                <span className="mr-3 font-mono text-xs text-stone-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {problem.title}
              </span>
              <span className="text-sm text-stone-500">Open</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
