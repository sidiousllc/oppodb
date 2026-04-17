import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MailContextType {
  isMailOpen: boolean;
  openMail: (tab?: MailTab) => void;
  closeMail: () => void;
  toggleMail: () => void;
  unreadMailCount: number;
  unreadAlertsCount: number;
  /** unreadMailCount + unreadAlertsCount — drives the topbar mail badge */
  unreadCount: number;
  initialTab: MailTab | null;
  consumeInitialTab: () => void;
  refreshAlerts: () => Promise<void>;
}

export type MailTab = "inbox" | "sent" | "compose" | "alerts";

const MailContext = createContext<MailContextType>({
  isMailOpen: false,
  openMail: () => {},
  closeMail: () => {},
  toggleMail: () => {},
  unreadMailCount: 0,
  unreadAlertsCount: 0,
  unreadCount: 0,
  initialTab: null,
  consumeInitialTab: () => {},
  refreshAlerts: async () => {},
});

export function MailProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [initialTab, setInitialTab] = useState<MailTab | null>(null);

  const loadUnreadMail = useCallback(async () => {
    if (!user) { setUnreadMailCount(0); return; }
    const { count } = await supabase
      .from("user_mail")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("deleted_by_recipient", false)
      .is("read_at", null);
    setUnreadMailCount(count || 0);
  }, [user]);

  const loadUnreadAlerts = useCallback(async () => {
    if (!user) { setUnreadAlertsCount(0); return; }
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    setUnreadAlertsCount(count || 0);
  }, [user]);

  useEffect(() => { loadUnreadMail(); loadUnreadAlerts(); }, [loadUnreadMail, loadUnreadAlerts]);

  // Realtime: new mail
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("mail-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_mail" }, (payload) => {
        if ((payload.new as any).recipient_id === user.id) {
          setUnreadMailCount(prev => prev + 1);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "user_mail" }, () => {
        loadUnreadMail();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadUnreadMail]);

  // Realtime: new notifications (alerts/watch matches)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("alerts-badge")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        setUnreadAlertsCount(prev => prev + 1);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadUnreadAlerts();
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadUnreadAlerts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadUnreadAlerts]);

  return (
    <MailContext.Provider value={{
      isMailOpen,
      openMail: (tab) => { if (tab) setInitialTab(tab); setIsMailOpen(true); },
      closeMail: () => { setIsMailOpen(false); loadUnreadMail(); loadUnreadAlerts(); },
      toggleMail: () => setIsMailOpen(v => !v),
      unreadMailCount,
      unreadAlertsCount,
      unreadCount: unreadMailCount + unreadAlertsCount,
      initialTab,
      consumeInitialTab: () => setInitialTab(null),
      refreshAlerts: loadUnreadAlerts,
    }}>
      {children}
    </MailContext.Provider>
  );
}

export function useMail() {
  return useContext(MailContext);
}
