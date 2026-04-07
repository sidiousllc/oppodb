import { supabase } from "@/integrations/supabase/client";

export interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  request_count: number;
  revoked_at: string | null;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const segments = [8, 8, 8, 8];
  return "ordb_" + segments.map((len) => {
    let s = "";
    const arr = crypto.getRandomValues(new Uint8Array(len));
    for (const b of arr) s += chars[b % chars.length];
    return s;
  }).join("-");
}

export async function createApiKey(
  name: string,
  customKey?: string,
): Promise<{ key: string; id: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const rawKey = customKey || generateApiKey();
  const keyHash = await hashKey(rawKey);
  const keyPrefix = rawKey.substring(0, 12) + "...";

  const { data, error } = await supabase
    .from("api_keys" as any)
    .insert({
      user_id: user.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
    } as any)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating API key:", error);
    return null;
  }

  return { key: rawKey, id: (data as any).id };
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from("api_keys" as any)
    .select("id,key_prefix,name,created_at,last_used_at,request_count,revoked_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error listing API keys:", error);
    return [];
  }
  return (data || []) as unknown as ApiKey[];
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  const { error } = await supabase
    .from("api_keys" as any)
    .update({ revoked_at: new Date().toISOString() } as any)
    .eq("id", keyId);

  if (error) {
    console.error("Error revoking API key:", error);
    return false;
  }
  return true;
}

export async function deleteApiKey(keyId: string): Promise<boolean> {
  const { error } = await supabase
    .from("api_keys" as any)
    .delete()
    .eq("id", keyId);

  if (error) {
    console.error("Error deleting API key:", error);
    return false;
  }
  return true;
}

export function getApiBaseUrl(): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1/public-api`;
}
