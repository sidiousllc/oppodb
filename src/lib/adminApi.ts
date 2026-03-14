import { supabase } from "@/integrations/supabase/client";

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
}

export async function listUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "list_users" },
  });
  if (error) throw error;
  return data.users || [];
}

export async function setUserRole(userId: string, role: string, remove = false) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "set_role", user_id: userId, role, remove },
  });
  if (error) throw error;
  return data;
}

export async function createUser(email: string, password: string, role: string = "user") {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "create_user", email, password, role },
  });
  if (error) throw error;
  return data;
}

export async function deleteUser(userId: string) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "delete_user", user_id: userId },
  });
  if (error) throw error;
  return data;
}
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "delete_user", user_id: userId },
  });
  if (error) throw error;
  return data;
}
