import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SectionPermission {
  id: string;
  section_id: string;
  subsection_id: string | null;
  entity_type: "user" | "group" | "role";
  entity_id: string;
  allowed: boolean;
  created_at: string;
  created_by: string | null;
}

/** All sections and their subsections for the app */
export const APP_SECTIONS: Record<string, { label: string; emoji: string; subsections?: Record<string, string> }> = {
  dashboard: { label: "Dashboard", emoji: "🏠" },
  oppohub: {
    label: "OppoHub", emoji: "🎯",
    subsections: {
      profiles: "Candidate Profiles",
      "maga-files": "MAGA Files",
      "local-impact": "Local Impact",
      narratives: "Narrative Reports",
    },
  },
  leghub: {
    label: "LegHub", emoji: "⚖️",
    subsections: {
      "state-leg": "State Legislative",
      "district-intel": "District Intel",
      "district-map": "District Map",
      "elections": "Election History",
      "presidential-county": "Presidential County Map",
    },
  },
  polling: {
    label: "DataHub", emoji: "📊",
    subsections: {
      "polling-data": "Polling Data",
      "campaign-finance": "Campaign Finance",
      "prediction-markets": "Prediction Markets",
      "voter-stats": "Voter Stats",
      "forecasts": "Election Forecasts",
    },
  },
  intelhub: {
    label: "IntelHub", emoji: "🕵️",
    subsections: {
      briefings: "Intel Briefings",
      "tracked-bills": "Tracked Bills",
      news: "News",
    },
  },
  messaging: {
    label: "MessagingHub", emoji: "📢",
    subsections: {
      guidance: "Messaging Guidance",
      research: "Research",
    },
  },
  "research-tools": {
    label: "Research Tools", emoji: "🔬",
    subsections: {
      "voter-data": "Voter Data",
      "court-records": "Court Records",
      "follow-money": "Follow the Money",
    },
  },
  "live-elections": { label: "Live Elections", emoji: "🏛️" },
  documentation: { label: "Documentation", emoji: "📖" },
};

export function useSectionAccess() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<SectionPermission[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    const { data } = await supabase
      .from("section_permissions")
      .select("*")
      .order("section_id");
    if (data) setPermissions(data as unknown as SectionPermission[]);
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    
    Promise.all([
      fetchPermissions(),
      supabase.from("user_roles" as any).select("role").eq("user_id", user.id).then(({ data }) => {
        setUserRoles(data?.map((r: any) => r.role) ?? []);
      }),
      supabase.from("role_group_members").select("group_id").eq("user_id", user.id).then(({ data }) => {
        setUserGroups(data?.map((r) => r.group_id) ?? []);
      }),
    ]).finally(() => setLoading(false));
  }, [user, fetchPermissions]);

  const canAccess = useCallback((sectionId: string, subsectionId?: string | null): boolean => {
    if (!user) return false;
    // Admins always have access
    if (userRoles.includes("admin")) return true;

    const relevantPerms = permissions.filter(
      (p) => p.section_id === sectionId &&
        (subsectionId ? p.subsection_id === subsectionId : p.subsection_id === null)
    );

    if (relevantPerms.length === 0) return true; // No rules = open

    // Check user-level
    const userDeny = relevantPerms.find(p => p.entity_type === "user" && p.entity_id === user.id && !p.allowed);
    if (userDeny) return false;
    const userAllow = relevantPerms.find(p => p.entity_type === "user" && p.entity_id === user.id && p.allowed);
    if (userAllow) return true;

    // Check group-level
    const groupDeny = relevantPerms.find(p => p.entity_type === "group" && userGroups.includes(p.entity_id) && !p.allowed);
    if (groupDeny) return false;
    const groupAllow = relevantPerms.find(p => p.entity_type === "group" && userGroups.includes(p.entity_id) && p.allowed);
    if (groupAllow) return true;

    // Check role-level
    const roleDeny = relevantPerms.find(p => p.entity_type === "role" && userRoles.includes(p.entity_id) && !p.allowed);
    if (roleDeny) return false;
    const roleAllow = relevantPerms.find(p => p.entity_type === "role" && userRoles.includes(p.entity_id) && p.allowed);
    if (roleAllow) return true;

    // If there are allow rules for this section but none match this user → deny
    const anyAllow = relevantPerms.some(p => p.allowed);
    if (anyAllow) return false;

    return true;
  }, [user, permissions, userRoles, userGroups]);

  return { canAccess, permissions, loading, refetch: fetchPermissions };
}

/** Admin hook: fetch all permissions for management */
export function useSectionPermissionsAdmin() {
  const [permissions, setPermissions] = useState<SectionPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("section_permissions")
      .select("*")
      .order("section_id");
    setPermissions(data as unknown as SectionPermission[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addPermission = useCallback(async (perm: {
    section_id: string;
    subsection_id: string | null;
    entity_type: string;
    entity_id: string;
    allowed: boolean;
  }) => {
    const { error } = await supabase.from("section_permissions").insert(perm as any);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const removePermission = useCallback(async (id: string) => {
    const { error } = await supabase.from("section_permissions").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const updatePermission = useCallback(async (id: string, allowed: boolean) => {
    const { error } = await supabase.from("section_permissions").update({ allowed } as any).eq("id", id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  return { permissions, loading, addPermission, removePermission, updatePermission, refetch: fetchAll };
}
