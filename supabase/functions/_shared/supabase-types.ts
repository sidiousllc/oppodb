// Shared Supabase client type alias for Edge Function helpers.
//
// Why this exists:
// `ReturnType<typeof createClient>` (without generics) resolves to
// `SupabaseClient<unknown, never, GenericSchema>` — the *fully-defaulted*
// signature. But when callers invoke `createClient(url, key)` at runtime
// without explicit generics, TS infers `SupabaseClient<any, "public", any>`.
// Those two types are not assignable to each other (TS2345), even though
// at runtime they're identical.
//
// Helpers should declare their `supabase`/`admin` parameter as `SupabaseLike`
// so any concrete `createClient(...)` result passes.

// deno-lint-ignore no-explicit-any
export type SupabaseLike = any;
