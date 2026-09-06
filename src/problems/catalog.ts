import type { CatalogProblem } from "./sum-of-array";
import { reverseString } from "./reverse-string";
import { sumOfArray } from "./sum-of-array";
import { twoSum } from "./two-sum";
import { validParentheses } from "./valid-parentheses";

export type { CatalogProblem };

export const PROBLEMS: CatalogProblem[] = [
  sumOfArray,
  twoSum,
  reverseString,
  validParentheses,
];

export function listProblems(): Pick<CatalogProblem, "id" | "title">[] {
  return PROBLEMS.map(({ id, title }) => ({ id, title }));
}

export function getProblem(id: string): CatalogProblem | undefined {
  return PROBLEMS.find((problem) => problem.id === id);
}
