import { describe, expect, it } from "vitest";
import { TypeScriptCompiler } from "./typescript-compiler";

describe("TypeScriptCompiler", () => {
  const compiler = new TypeScriptCompiler();

  it("transpiles valid TypeScript into JavaScript", () => {
    const result = compiler.compile(`
      function solution(n: number): number {
        return n + 1;
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.js).toContain("function solution");
    expect(result.js).not.toContain(": number");
  });

  it("returns compile failure for syntax errors", () => {
    const result = compiler.compile(`
      function solution(n: number {
        return n;
      }
    `);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.length).toBeGreaterThan(0);
  });
});
