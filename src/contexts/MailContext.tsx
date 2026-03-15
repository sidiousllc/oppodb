import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MailContextType {
  isMailOpen: boolean;
  openMail: () => void;
  closeMail: () => void;
  toggleMail: () => void;
  unreadCount: number;
}

const MailContext = createContext<MailContextType>({
  isMailOpen: false,
  openMail: () => {},
  closeMail: () => {},
  toggleMail: () => {},
  unreadCount: 0,
});

export function MailProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!user) { setUnreadCount(0); return; }
    const { count } = await supabase
      .from("user_mail")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("deleted_by_recipient", false)
      .is("read_at", null);
    setUnreadCount(count || 0);
  }, [user]);

  useEffect(() => { loadUnread(); }, [loadUnread]);

  // Listen for new mail
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("mail-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_mail" }, (payload) => {
        if ((payload.new as any).recipient_id === user.id) {
          setUnreadCount(prev => prev + 1);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "user_mail" }, () => {
        loadUnread();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadUnread]);

  return (
    <MailContext.Provider value={{
      isMailOpen,
      openMail: () => setIsMailOpen(true),
      closeMail: () => { setIsMailOpen(false); loadUnread(); },
      toggleMail: () => setIsMailOpen(v => !v),
      unreadCount,
    }}>
      {children}
    </MailContext.Provider>
  );
}

export function useMail() {
  return useContext(MailContext);
}
