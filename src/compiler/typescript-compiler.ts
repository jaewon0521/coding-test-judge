import ts from "typescript";
import { formatCompileError } from "./compile-error";
import type { CompileResult, Compiler } from "./compiler";

export class TypeScriptCompiler implements Compiler {
  compile(source: string): CompileResult {
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES2020,
      },
      reportDiagnostics: true,
    });

    const errors = (transpiled.diagnostics ?? []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );

    if (errors.length > 0) {
      return {
        ok: false,
        error: formatCompileError(errors.map(formatDiagnostic).join("\n")),
      };
    }

    return {
      ok: true,
      js: transpiled.outputText,
    };
  }
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (diagnostic.file && diagnostic.start !== undefined) {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start,
    );
    return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
  }
  return message;
}
