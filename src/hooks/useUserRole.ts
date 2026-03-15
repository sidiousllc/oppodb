import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AppRole = "admin" | "moderator" | "user" | "premium";

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = roles.includes("admin");
  const isModerator = roles.includes("moderator");
  const isPremium = roles.includes("premium");
  const canManageContent = isAdmin || isModerator;
  const canAccessApi = isAdmin || isPremium;

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (!error && data) {
          setRoles(data.map((r) => r.role as AppRole));
        }
        setLoading(false);
      });
  }, [user]);

  return { roles, isAdmin, isModerator, isPremium, canManageContent, canAccessApi, loading };
}
