import { supabase } from "@/integrations/supabase/client";

export interface SerialKey {
  id: string;
  serial: string;
  device_id: string | null;
  device_bound_at: string | null;
  last_validated_at: string | null;
  validation_count: number;
  revoked_at: string | null;
  notes: string | null;
  created_at: string;
}

const SERIAL_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
export function generateSerial(groups = 5, groupLen = 5): string {
  const alphabetLen = SERIAL_CHARS.length;
  const maxUnbiased = Math.floor(256 / alphabetLen) * alphabetLen;
  const parts: string[] = [];
  for (let g = 0; g < groups; g++) {
    let s = "";
    while (s.length < groupLen) {
      const byte = crypto.getRandomValues(new Uint8Array(1))[0];
      if (byte >= maxUnbiased) continue;
      s += SERIAL_CHARS[byte % alphabetLen];
    }
    parts.push(s);
  }
  return parts.join("-");
}

export function isValidCustomSerial(s: string): boolean {
  return /^[A-Z0-9-]{6,128}$/.test(s.trim());
}

export async function listMySerials(): Promise<SerialKey[]> {
  const { data, error } = await supabase
    .from("app_serial_keys" as any)
    .select("id,serial,device_id,device_bound_at,last_validated_at,validation_count,revoked_at,notes,created_at")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data || []) as unknown as SerialKey[];
}

export async function createSerial(opts?: { custom?: string; notes?: string }): Promise<SerialKey | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const serial = (opts?.custom?.trim().toUpperCase()) || generateSerial();
  if (!isValidCustomSerial(serial)) throw new Error("Serial must be 6–128 chars, A–Z 0–9 and dashes only.");
  const { data, error } = await supabase
    .from("app_serial_keys" as any)
    .insert({ user_id: user.id, serial, notes: opts?.notes ?? null } as any)
    .select("id,serial,device_id,device_bound_at,last_validated_at,validation_count,revoked_at,notes,created_at")
    .single();
  if (error) {
    if ((error as any).code === "23505") throw new Error("That serial is already in use. Try another.");
    throw error;
  }
  return data as unknown as SerialKey;
}

export async function regenerateSerial(id: string): Promise<SerialKey | null> {
  const newSerial = generateSerial();
  const { data, error } = await supabase
    .from("app_serial_keys" as any)
    .update({ serial: newSerial, device_id: null, device_bound_at: null, revoked_at: null } as any)
    .eq("id", id)
    .select("id,serial,device_id,device_bound_at,last_validated_at,validation_count,revoked_at,notes,created_at")
    .single();
  if (error) throw error;
  return data as unknown as SerialKey;
}

export async function revokeSerial(id: string): Promise<void> {
  const { error } = await supabase.from("app_serial_keys" as any)
    .update({ revoked_at: new Date().toISOString() } as any).eq("id", id);
  if (error) throw error;
}

export async function reactivateSerial(id: string): Promise<void> {
  const { error } = await supabase.from("app_serial_keys" as any)
    .update({ revoked_at: null } as any).eq("id", id);
  if (error) throw error;
}

export async function unbindDevice(id: string): Promise<void> {
  const { error } = await supabase.rpc("unbind_serial_device" as any, { p_key_id: id } as any);
  if (error) throw error;
}

export async function deleteSerial(id: string): Promise<void> {
  const { error } = await supabase.from("app_serial_keys" as any).delete().eq("id", id);
  if (error) throw error;
}
