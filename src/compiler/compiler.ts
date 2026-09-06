export type CompileResult =
  | { ok: true; js: string }
  | { ok: false; error: string };

export interface Compiler {
  compile(source: string): CompileResult;
}
