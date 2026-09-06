export function formatRuntimeError(error: unknown): string {
  if (error instanceof Error) {
    return ensureNonEmpty(error.message, "Runtime error");
  }

  if (typeof error === "string") {
    return ensureNonEmpty(error, "Runtime error");
  }

  if (error === undefined) {
    return "Runtime error";
  }

  return ensureNonEmpty(String(error), "Runtime error");
}

function ensureNonEmpty(message: string, fallback: string): string {
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}
