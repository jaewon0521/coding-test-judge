import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemWorkspace } from "@/components/problem-workspace";
import { getProblem } from "@/problems/catalog";

type ProblemPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProblemPage({ params }: ProblemPageProps) {
  const { id } = await params;
  const problem = getProblem(id);

  if (!problem) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col bg-stone-100 text-stone-900">
      <header className="flex items-center justify-between border-b border-stone-300 px-5 py-3">
        <Link
          href="/"
          className="text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          ← Problems
        </Link>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
          Browser Judge
        </p>
      </header>
      <ProblemWorkspace problem={problem} />
    </main>
  );
}
