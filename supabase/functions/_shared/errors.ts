// Shared error-message helper for Edge Functions.
// Use to safely extract a string from `unknown` thrown values, since
// TypeScript narrows `catch` bindings to `unknown` (TS18046).
//
// Usage:
//   try { ... } catch (err) {
//     return new Response(JSON.stringify({ error: getErrorMessage(err) }), { status: 500 });
//   }

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    // Postgres / Supabase / fetch errors often expose `message`
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err ?? "Unknown error");
}

// Optional helper that also yields a stack when available (for logging).
export function getErrorDetails(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  return { message: getErrorMessage(err) };
}
