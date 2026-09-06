export function formatCompileError(message: string): string {
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : "Compile error";
}
