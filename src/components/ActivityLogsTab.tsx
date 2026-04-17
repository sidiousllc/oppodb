import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Search, X } from "lucide-react";

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

type UnifiedLog = {
  id: string;
  kind: "activity" | "api" | "content" | "chat";
  userId: string;
  date: string;
  searchText: string;
  raw: ActivityLog | ApiLog | ContentVersion | ChatMsg;
};

export function ActivityLogsTab() {
  const [category, setCategory] = useState<LogCategory>("all");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [contentVersions, setContentVersions] = useState<ContentVersion[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  // Filters
  const [filterUser, setFilterUser] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name");

    const pMap: Record<string, string> = {};
    if (profiles) {
      for (const p of profiles) pMap[p.id] = p.display_name || p.id.slice(0, 8);
    }
    setProfileMap(pMap);

    const promises: Promise<unknown>[] = [];

    if (category === "all" || category === "page_view" || category === "map_view") {
      promises.push(
        Promise.resolve(
          supabase
            .from("user_activity_logs" as any)
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500)
        ).then(({ data }) => {
          let logs = (data || []) as unknown as ActivityLog[];
          if (category === "page_view") logs = logs.filter(l => l.activity_type === "page_view");
          if (category === "map_view") logs = logs.filter(l => l.activity_type === "map_view");
          setActivityLogs(logs);
        })
      );
    } else {
      setActivityLogs([]);
    }

    if (category === "all" || category === "api") {
      promises.push(
        Promise.resolve(
          supabase
            .from("api_request_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500)
        ).then(({ data }) => setApiLogs((data || []) as ApiLog[]))
      );
    } else {
      setApiLogs([]);
    }

    if (category === "all" || category === "content") {
      promises.push(
        Promise.resolve(
          supabase
            .from("candidate_versions")
            .select("id, github_path, author, commit_message, commit_date")
            .order("commit_date", { ascending: false })
            .limit(200)
        ).then(({ data }) => setContentVersions((data || []) as ContentVersion[]))
      );
    } else {
      setContentVersions([]);
    }

    if (category === "all" || category === "chat") {
      promises.push(
        Promise.resolve(
          supabase
            .from("chat_messages")
            .select("id, sender_id, receiver_id, content, created_at")
            .order("created_at", { ascending: false })
            .limit(500)
        ).then(({ data }) => setChatLogs((data || []) as ChatMsg[]))
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

  // Build unified list for filtering
  const allUnified = useMemo<UnifiedLog[]>(() => {
    const list: UnifiedLog[] = [];
    for (const l of activityLogs) {
      list.push({
        id: l.id, kind: "activity", userId: l.user_id, date: l.created_at,
        searchText: `${formatDetails(l.details)} ${l.activity_type}`,
        raw: l,
      });
    }
    for (const l of apiLogs) {
      list.push({
        id: l.id, kind: "api", userId: l.user_id, date: l.created_at,
        searchText: `${l.endpoint} ${l.status_code}`,
        raw: l,
      });
    }
    for (const v of contentVersions) {
      list.push({
        id: v.id, kind: "content", userId: "", date: v.commit_date,
        searchText: `${v.author} ${v.github_path} ${v.commit_message}`,
        raw: v,
      });
    }
    for (const m of chatLogs) {
      list.push({
        id: m.id, kind: "chat", userId: m.sender_id, date: m.created_at,
        searchText: `${m.content}`,
        raw: m,
      });
    }
    return list;
  }, [activityLogs, apiLogs, contentVersions, chatLogs]);

  // Unique users for dropdown
  const uniqueUsers = useMemo(() => {
    const ids = new Set<string>();
    for (const l of allUnified) {
      if (l.userId) ids.add(l.userId);
      if (l.kind === "chat") ids.add((l.raw as ChatMsg).receiver_id);
    }
    // Also add content authors mapped by name
    return Array.from(ids)
      .map(id => ({ id, name: profileMap[id] || id.slice(0, 8) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allUnified, profileMap]);

  // Apply filters
  const filtered = useMemo(() => {
    const lowerSearch = filterSearch.toLowerCase();
    const fromDate = filterDateFrom ? new Date(filterDateFrom + "T00:00:00") : null;
    const toDate = filterDateTo ? new Date(filterDateTo + "T23:59:59") : null;

    return allUnified.filter(l => {
      // User filter
      if (filterUser) {
        const matchesUser = l.userId === filterUser;
        const matchesChatReceiver = l.kind === "chat" && (l.raw as ChatMsg).receiver_id === filterUser;
        const matchesContentAuthor = l.kind === "content" && (l.raw as ContentVersion).author.toLowerCase().includes((profileMap[filterUser] || "").toLowerCase());
        if (!matchesUser && !matchesChatReceiver && !matchesContentAuthor) return false;
      }
      // Text search
      if (lowerSearch) {
        const userNameStr = userName(l.userId).toLowerCase();
        if (!l.searchText.toLowerCase().includes(lowerSearch) && !userNameStr.includes(lowerSearch)) return false;
      }
      // Date range
      const logDate = new Date(l.date);
      if (fromDate && logDate < fromDate) return false;
      if (toDate && logDate > toDate) return false;
      return true;
    });
  }, [allUnified, filterUser, filterSearch, filterDateFrom, filterDateTo, profileMap]);

  // Split filtered back into categories for rendering
  const fActivity = filtered.filter(l => l.kind === "activity").map(l => l.raw as ActivityLog);
  const fApi = filtered.filter(l => l.kind === "api").map(l => l.raw as ApiLog);
  const fContent = filtered.filter(l => l.kind === "content").map(l => l.raw as ContentVersion);
  const fChat = filtered.filter(l => l.kind === "chat").map(l => l.raw as ChatMsg);

  const hasFilters = filterUser || filterSearch || filterDateFrom || filterDateTo;
  const clearFilters = () => { setFilterUser(""); setFilterSearch(""); setFilterDateFrom(""); setFilterDateTo(""); };

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
      <div className="flex gap-0.5 mb-2 flex-wrap">
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

      {/* Filter bar */}
      <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 mb-3">
        <div className="flex gap-2 flex-wrap items-end">
          {/* User filter */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] font-bold">👤 User</label>
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="win98-input text-[9px] w-[140px]"
            >
              <option value="">All users</option>
              {uniqueUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Text search */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] font-bold">🔍 Search</label>
            <div className="flex items-center gap-0.5">
              <input
                type="text"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Filter by message, endpoint..."
                className="win98-input text-[9px] w-[180px]"
              />
            </div>
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] font-bold">📅 From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="win98-input text-[9px] w-[110px]"
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] font-bold">📅 To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="win98-input text-[9px] w-[110px]"
            />
          </div>

          {/* Clear */}
          {hasFilters && (
            <button onClick={clearFilters} className="win98-button text-[9px] px-2 py-0.5 flex items-center gap-0.5" title="Clear filters">
              <X className="h-2.5 w-2.5" /> Clear
            </button>
          )}

          {/* Raw JSON toggle */}
          <button
            onClick={() => setShowRaw(v => !v)}
            className={`win98-button text-[9px] px-2 py-0.5 ${showRaw ? "font-bold bg-white" : ""}`}
            title="Toggle raw JSON output for all logs"
          >
            {`{ }`} {showRaw ? "Hide Raw" : "Show Raw"}
          </button>
          <button
            onClick={() => {
              const payload = { activity: fActivity, api: fApi, content: fContent, chat: fChat };
              navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            }}
            className="win98-button text-[9px] px-2 py-0.5"
            title="Copy raw JSON of filtered logs to clipboard"
          >
            📋 Copy Raw
          </button>
          <button
            onClick={() => {
              const payload = { activity: fActivity, api: fApi, content: fContent, chat: fChat };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `access-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="win98-button text-[9px] px-2 py-0.5"
            title="Download raw JSON of filtered logs"
          >
            💾 Export JSON
          </button>
        </div>
        {hasFilters && (
          <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
            Showing {filtered.length} of {allUnified.length} logs
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-[10px]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading logs...
        </div>
      ) : (
        <div className="space-y-3">
          {fActivity.length > 0 && (
            <LogSection title={category === "map_view" ? "🗺️ Map Access" : category === "page_view" ? "👁️ Page Views" : "👁️ Page & Map Activity"} count={fActivity.length}>
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
                  {fActivity.map(log => (
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
              {showRaw && <RawBlock data={fActivity} />}
            </LogSection>
          )}

          {fApi.length > 0 && (
            <LogSection title="🔑 API Request Logs" count={fApi.length}>
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
                  {fApi.map(log => (
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
              {showRaw && <RawBlock data={fApi} />}
            </LogSection>
          )}

          {fContent.length > 0 && (
            <LogSection title="📝 Content Change History" count={fContent.length}>
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
                  {fContent.map(v => (
                    <tr key={v.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))]">
                      <td className="px-2 py-1 font-bold">{v.author}</td>
                      <td className="px-2 py-1 font-mono">{v.github_path.split("/").pop()}</td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">{v.commit_message}</td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">{fmtDate(v.commit_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {showRaw && <RawBlock data={fContent} />}
            </LogSection>
          )}

          {fChat.length > 0 && (
            <LogSection title="💬 Chat Logs" count={fChat.length}>
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
                  {fChat.map(msg => (
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

          {fActivity.length === 0 && fApi.length === 0 && fContent.length === 0 && fChat.length === 0 && (
            <div className="text-center py-8 text-[10px] text-[hsl(var(--muted-foreground))]">
              📭 No logs found{hasFilters ? " matching your filters" : " for this category"}.
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
