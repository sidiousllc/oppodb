import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";

type LogCategory = "all" | "page_view" | "map_view" | "api" | "content" | "chat";

interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface ApiLog {
  id: string;
  user_id: string;
  api_key_id: string;
  endpoint: string;
  status_code: number;
  created_at: string;
}

interface ContentVersion {
  id: string;
  github_path: string;
  author: string;
  commit_message: string;
  commit_date: string;
}

interface ChatMsg {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export function ActivityLogsTab() {
  const [category, setCategory] = useState<LogCategory>("all");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [contentVersions, setContentVersions] = useState<ContentVersion[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);

    // Load profiles for user display names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name");

    const pMap: Record<string, string> = {};
    if (profiles) {
      for (const p of profiles) pMap[p.id] = p.display_name || p.id.slice(0, 8);
    }
    setProfileMap(pMap);

    const promises: Promise<unknown>[] = [];

    // Activity logs (page views, map views)
    if (category === "all" || category === "page_view" || category === "map_view") {
      promises.push(
        supabase
          .from("user_activity_logs" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
          .then(({ data }) => {
            let logs = (data || []) as unknown as ActivityLog[];
            if (category === "page_view") logs = logs.filter(l => l.activity_type === "page_view");
            if (category === "map_view") logs = logs.filter(l => l.activity_type === "map_view");
            setActivityLogs(logs);
          })
      );
    } else {
      setActivityLogs([]);
    }

    // API logs
    if (category === "all" || category === "api") {
      promises.push(
        supabase
          .from("api_request_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
          .then(({ data }) => setApiLogs((data || []) as ApiLog[]))
      );
    } else {
      setApiLogs([]);
    }

    // Content change history
    if (category === "all" || category === "content") {
      promises.push(
        supabase
          .from("candidate_versions")
          .select("id, github_path, author, commit_message, commit_date")
          .order("commit_date", { ascending: false })
          .limit(100)
          .then(({ data }) => setContentVersions((data || []) as ContentVersion[]))
      );
    } else {
      setContentVersions([]);
    }

    // Chat logs
    if (category === "all" || category === "chat") {
      promises.push(
        supabase
          .from("chat_messages")
          .select("id, sender_id, receiver_id, content, created_at")
          .order("created_at", { ascending: false })
          .limit(200)
          .then(({ data }) => setChatLogs((data || []) as ChatMsg[]))
      );
    } else {
      setChatLogs([]);
    }

    await Promise.all(promises);
    setLoading(false);
  }, [category]);

  useEffect(() => { loadData(); }, [loadData]);

  const userName = (id: string) => profileMap[id] || id.slice(0, 8) + "…";
  const fmtDate = (d: string) => new Date(d).toLocaleString();

  const categories: Array<{ id: LogCategory; label: string; emoji: string }> = [
    { id: "all", label: "All", emoji: "📋" },
    { id: "page_view", label: "Page Views", emoji: "👁️" },
    { id: "map_view", label: "Map Access", emoji: "🗺️" },
    { id: "api", label: "API Calls", emoji: "🔑" },
    { id: "content", label: "Content Changes", emoji: "📝" },
    { id: "chat", label: "Chat Logs", emoji: "💬" },
  ];

  return (
    <div>
      {/* Category filters */}
      <div className="flex gap-0.5 mb-3 flex-wrap">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`win98-button text-[9px] px-2 py-0.5 ${category === c.id ? "font-bold bg-white" : ""}`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
        <button onClick={loadData} className="win98-button text-[9px] px-2 py-0.5 ml-auto" title="Refresh">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-[10px]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading logs...
        </div>
      ) : (
        <div className="space-y-3">
          {/* Activity logs (page views / map views) */}
          {activityLogs.length > 0 && (
            <LogSection title={category === "map_view" ? "🗺️ Map Access" : category === "page_view" ? "👁️ Page Views" : "👁️ Page & Map Activity"} count={activityLogs.length}>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                    <th className="text-left px-2 py-1 font-bold">User</th>
                    <th className="text-left px-2 py-1 font-bold">Type</th>
                    <th className="text-left px-2 py-1 font-bold">Details</th>
                    <th className="text-left px-2 py-1 font-bold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map(log => (
                    <tr key={log.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))]">
                      <td className="px-2 py-1 font-bold">{userName(log.user_id)}</td>
                      <td className="px-2 py-1">
                        <span className={`px-1 py-0 win98-sunken text-[8px] font-bold ${log.activity_type === "map_view" ? "text-blue-700 bg-blue-50" : "text-green-700 bg-green-50"}`}>
                          {log.activity_type === "map_view" ? "🗺️ map" : "👁️ page"}
                        </span>
                      </td>
                      <td className="px-2 py-1 font-mono text-[hsl(var(--muted-foreground))]">
                        {formatDetails(log.details)}
                      </td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">{fmtDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </LogSection>
          )}

          {/* API logs */}
          {apiLogs.length > 0 && (
            <LogSection title="🔑 API Request Logs" count={apiLogs.length}>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                    <th className="text-left px-2 py-1 font-bold">User</th>
                    <th className="text-left px-2 py-1 font-bold">Endpoint</th>
                    <th className="text-left px-2 py-1 font-bold">Status</th>
                    <th className="text-left px-2 py-1 font-bold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {apiLogs.map(log => (
                    <tr key={log.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))]">
                      <td className="px-2 py-1 font-bold">{userName(log.user_id)}</td>
                      <td className="px-2 py-1 font-mono">{log.endpoint}</td>
                      <td className="px-2 py-1">
                        <span className={`px-1 py-0 win98-sunken text-[8px] font-bold ${log.status_code < 400 ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}`}>
                          {log.status_code}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">{fmtDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </LogSection>
          )}

          {/* Content changes */}
          {contentVersions.length > 0 && (
            <LogSection title="📝 Content Change History" count={contentVersions.length}>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                    <th className="text-left px-2 py-1 font-bold">Author</th>
                    <th className="text-left px-2 py-1 font-bold">File</th>
                    <th className="text-left px-2 py-1 font-bold">Message</th>
                    <th className="text-left px-2 py-1 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {contentVersions.map(v => (
                    <tr key={v.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))]">
                      <td className="px-2 py-1 font-bold">{v.author}</td>
                      <td className="px-2 py-1 font-mono">{v.github_path.split("/").pop()}</td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">{v.commit_message}</td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">{fmtDate(v.commit_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </LogSection>
          )}

          {/* Chat logs */}
          {chatLogs.length > 0 && (
            <LogSection title="💬 Chat Logs" count={chatLogs.length}>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                    <th className="text-left px-2 py-1 font-bold">From</th>
                    <th className="text-left px-2 py-1 font-bold">To</th>
                    <th className="text-left px-2 py-1 font-bold">Message</th>
                    <th className="text-left px-2 py-1 font-bold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {chatLogs.map(msg => (
                    <tr key={msg.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))]">
                      <td className="px-2 py-1 font-bold">{userName(msg.sender_id)}</td>
                      <td className="px-2 py-1">{userName(msg.receiver_id)}</td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))] truncate max-w-[250px]">{msg.content}</td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">{fmtDate(msg.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </LogSection>
          )}

          {/* Empty state */}
          {activityLogs.length === 0 && apiLogs.length === 0 && contentVersions.length === 0 && chatLogs.length === 0 && (
            <div className="text-center py-8 text-[10px] text-[hsl(var(--muted-foreground))]">
              📭 No logs found for this category.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LogSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold mb-1">{title} <span className="font-normal text-[hsl(var(--muted-foreground))]">({count})</span></p>
      <div className="win98-sunken bg-white overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

function formatDetails(details: Record<string, unknown>): string {
  if (!details || Object.keys(details).length === 0) return "—";
  const parts: string[] = [];
  if (details.page) parts.push(`page: ${details.page}`);
  if (details.map_type) parts.push(`map: ${details.map_type}`);
  if (details.section) parts.push(`section: ${details.section}`);
  if (details.district) parts.push(`district: ${details.district}`);
  if (details.state) parts.push(`state: ${details.state}`);
  if (parts.length === 0) return JSON.stringify(details);
  return parts.join(" · ");
}
