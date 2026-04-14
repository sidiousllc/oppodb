import { supabase } from "@/integrations/supabase/client";

type ContentTable = "candidate_profiles" | "maga_files" | "local_impacts" | "narrative_reports" | "messaging_guidance" | "wiki_pages" | "international_profiles" | "international_elections" | "international_leaders";

async function callContentAdmin(payload: {
  action: "insert" | "update" | "delete";
  table: ContentTable;
  record?: Record<string, unknown>;
  id?: string;
}) {
  const { data, error } = await supabase.functions.invoke("content-admin", {
    body: payload,
  });

  if (error) throw new Error(error.message || "Content operation failed");
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

export async function insertContent(table: ContentTable, record: Record<string, unknown>) {
  return callContentAdmin({ action: "insert", table, record });
}

export async function updateContent(table: ContentTable, id: string, record: Record<string, unknown>) {
  return callContentAdmin({ action: "update", table, id, record });
}

export async function deleteContent(table: ContentTable, id: string) {
  return callContentAdmin({ action: "delete", table, id });
}
