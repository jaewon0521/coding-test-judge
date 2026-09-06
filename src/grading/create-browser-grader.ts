"use client";

import { TypeScriptCompiler } from "@/compiler/typescript-compiler";
import { WebWorkerExecutor } from "@/executor/web-worker-executor";
import { Grader } from "@/grader/grader";
import { ExactComparator } from "@/judge/exact-comparator";
import { Judge } from "@/judge/judge";

export function createBrowserGrader(): Grader {
  const executor = new WebWorkerExecutor(new TypeScriptCompiler());
  const judge = new Judge(new ExactComparator());
  return new Grader(executor, judge);
}
