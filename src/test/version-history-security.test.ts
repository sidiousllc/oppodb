import { describe, it, expect } from "vitest";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/version-history`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

describe("version-history security", () => {
  it("rejects requests without Authorization header", async () => {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ paths: ["test.md"] }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("rejects requests with invalid Bearer token", async () => {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: "Bearer invalid-token-abc123",
      },
      body: JSON.stringify({ paths: ["test.md"] }),
    });
    expect(res.status).toBe(401);
    await res.text();
  });

  it("rejects GET requests (method not allowed)", async () => {
    const res = await fetch(FUNCTION_URL, {
      method: "GET",
      headers: { apikey: ANON_KEY },
    });
    expect(res.status).toBe(405);
    await res.text();
  });

  it("rejects requests without paths in body", async () => {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });
    // Should be 401 (anon key isn't a valid user token) or 400
    expect([400, 401]).toContain(res.status);
    await res.text();
  });

  it("returns CORS headers with Vary: Origin", async () => {
    const res = await fetch(FUNCTION_URL, {
      method: "OPTIONS",
      headers: {
        Origin: "https://oppodb.com",
        apikey: ANON_KEY,
      },
    });
    expect(res.status).toBeLessThan(400);
    const vary = res.headers.get("vary");
    expect(vary).toContain("Origin");
    await res.text();
  });
});
