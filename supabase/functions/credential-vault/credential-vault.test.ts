import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertNotEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.test("user_integrations RLS and encryption", async (t) => {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const email1 = `rls-test-1-${Date.now()}@test.local`;
  const email2 = `rls-test-2-${Date.now()}@test.local`;
  const password = "TestPassword123!";

  const { data: u1 } = await adminClient.auth.admin.createUser({ email: email1, password, email_confirm: true });
  const { data: u2 } = await adminClient.auth.admin.createUser({ email: email2, password, email_confirm: true });
  assert(u1?.user && u2?.user, "Test users created");

  const user1Id = u1.user.id;
  const user2Id = u2.user.id;

  const client1 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: s1 } = await client1.auth.signInWithPassword({ email: email1, password });
  assert(s1?.session, "User 1 signed in");

  const client2 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: s2 } = await client2.auth.signInWithPassword({ email: email2, password });
  assert(s2?.session, "User 2 signed in");

  const PLAINTEXT_KEY = "nb_test_api_key_12345";
  let integrationId: string | null = null;

  try {
    // Test 1: Save via credential-vault (tests encryption)
    await t.step("credential-vault encrypts API key on save", async () => {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/credential-vault`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s1.session!.access_token}`,
        },
        body: JSON.stringify({
          action: "save",
          api_key: PLAINTEXT_KEY,
          service: "nationbuilder",
          slug: "testorg",
          display_name: "NationBuilder Test",
        }),
      });
      const data = await resp.json();
      assertEquals(resp.status, 200, `Save should succeed: ${JSON.stringify(data)}`);
      assert(data.success);
    });

    // Test 2: Verify stored value is NOT plaintext
    await t.step("stored api_key is encrypted (not plaintext)", async () => {
      const { data: rows } = await adminClient
        .from("user_integrations")
        .select("id, api_key")
        .eq("user_id", user1Id)
        .eq("service", "nationbuilder");

      assert(rows && rows.length > 0, "Row should exist");
      integrationId = rows[0].id;
      const storedKey = rows[0].api_key;
      assertNotEquals(storedKey, PLAINTEXT_KEY, "Stored key must NOT be plaintext");
      assert(storedKey.length > 20, "Encrypted value should be substantial");
    });

    // Test 3: User 1 can read own rows
    await t.step("user can read own integrations", async () => {
      const { data, error } = await client1
        .from("user_integrations")
        .select("id, service")
        .eq("service", "nationbuilder");

      assertEquals(error, null);
      assert(data && data.length > 0, "User 1 should see their own row");
    });

    // Test 4: User 2 CANNOT read User 1's rows
    await t.step("cross-user read is blocked by RLS", async () => {
      const { data } = await client2
        .from("user_integrations")
        .select("id, service")
        .eq("service", "nationbuilder");

      assertEquals(data?.length ?? 0, 0, "User 2 must NOT see User 1's integrations");
    });

    // Test 5: Cross-user update blocked
    await t.step("cross-user update is blocked by RLS", async () => {
      assert(integrationId, "Integration ID must exist from earlier step");
      const { data } = await client2
        .from("user_integrations")
        .update({ display_name: "HACKED" } as any)
        .eq("id", integrationId)
        .select();

      assertEquals(data?.length ?? 0, 0, "Cross-user update must affect 0 rows");
    });

    // Test 6: Cross-user delete blocked
    await t.step("cross-user delete is blocked by RLS", async () => {
      assert(integrationId, "Integration ID must exist");
      const { data } = await client2
        .from("user_integrations")
        .delete()
        .eq("id", integrationId)
        .select();

      assertEquals(data?.length ?? 0, 0, "Cross-user delete must affect 0 rows");

      // Verify row still exists
      const { data: verify } = await adminClient
        .from("user_integrations")
        .select("id")
        .eq("id", integrationId);

      assert(verify && verify.length > 0, "Row must still exist");
    });

    // Test 7: Cannot insert for another user_id
    await t.step("user cannot insert row for another user_id", async () => {
      const { error } = await client2
        .from("user_integrations")
        .insert({
          user_id: user1Id,
          service: "van",
          api_key: "fake",
          display_name: "Impersonated",
        } as any);

      assert(error !== null, "Insert with wrong user_id should be rejected");
    });

  } finally {
    await adminClient.from("user_integrations").delete().eq("user_id", user1Id);
    await adminClient.from("user_integrations").delete().eq("user_id", user2Id);
    await adminClient.auth.admin.deleteUser(user1Id);
    await adminClient.auth.admin.deleteUser(user2Id);
  }
});
