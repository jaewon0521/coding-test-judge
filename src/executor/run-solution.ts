export function runSolution(js: string, input: unknown): unknown {
  const runner = new Function(
    "input",
    `${js}
; if (typeof solution !== "function") {
  throw new Error("solution is not defined");
}
return solution(input);`,
  );

  return runner(input);
}
