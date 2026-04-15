import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Search, X, Eye, Globe, FileText, MessageSquare, Key, Mail, Bot } from "lucide-react";
import { Win98Window } from "./Win98Window";

type LogCategory = "all" | "page_view" | "map_view" | "api" | "content" | "chat" | "mail" | "research";

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
  commit_sha: string;
  content: string;
}

interface ChatMsg {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface MailMsg {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  read_at: string | null;
  deleted_by_sender: boolean;
  deleted_by_recipient: boolean;
  created_at: string;
}

type UnifiedLog = {
  id: string;
  kind: "activity" | "api" | "content" | "chat" | "mail" | "research";
  userId: string;
  date: string;
  searchText: string;
  raw: ActivityLog | ApiLog | ContentVersion | ChatMsg | MailMsg;
};

type DetailItem = { kind: "activity"; data: ActivityLog }
  | { kind: "api"; data: ApiLog }
  | { kind: "content"; data: ContentVersion }
  | { kind: "chat"; data: ChatMsg }
  | { kind: "mail"; data: MailMsg }
  | { kind: "research"; data: ActivityLog };

export function ActivityLogsTab() {
  const [category, setCategory] = useState<LogCategory>("all");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [contentVersions, setContentVersions] = useState<ContentVersion[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatMsg[]>([]);
  const [mailLogs, setMailLogs] = useState<MailMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<DetailItem | null>(null);

  // Filters
  const [filterUser, setFilterUser] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

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

    if (category === "all" || category === "page_view" || category === "map_view" || category === "research") {
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
          if (category === "research") logs = logs.filter(l => l.activity_type === "chat_send" || l.activity_type === "api_call");
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
            .select("id, github_path, author, commit_message, commit_date, commit_sha, content")
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
            .select("id, sender_id, receiver_id, content, created_at, read_at")
            .order("created_at", { ascending: false })
            .limit(500)
        ).then(({ data }) => setChatLogs((data || []) as ChatMsg[]))
      );
    } else {
      setChatLogs([]);
    }

    if (category === "all" || category === "mail") {
      promises.push(
        Promise.resolve(
          supabase
            .from("user_mail" as any)
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500)
        ).then(({ data }) => setMailLogs((data || []) as unknown as MailMsg[]))
      );
    } else {
      setMailLogs([]);
    }

    await Promise.all(promises);
    setLoading(false);
  }, [category]);

  useEffect(() => { loadData(); }, [loadData]);

  const userName = (id: string) => profileMap[id] || id.slice(0, 8) + "…";
  const fmtDate = (d: string) => new Date(d).toLocaleString();
  const fmtDateLong = (d: string) => new Date(d).toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  // Separate research-type activity logs
  const researchLogs = useMemo(() =>
    activityLogs.filter(l => l.activity_type === "chat_send" || l.activity_type === "api_call"),
    [activityLogs]
  );
  const standardLogs = useMemo(() =>
    category === "research" ? [] : activityLogs.filter(l => l.activity_type !== "chat_send" && l.activity_type !== "api_call"),
    [activityLogs, category]
  );

  // Build unified list for filtering
  const allUnified = useMemo<UnifiedLog[]>(() => {
    const list: UnifiedLog[] = [];
    for (const l of standardLogs) {
      list.push({
        id: l.id, kind: "activity", userId: l.user_id, date: l.created_at,
        searchText: `${formatDetails(l.details)} ${l.activity_type}`,
        raw: l,
      });
    }
    for (const l of researchLogs) {
      list.push({
        id: l.id, kind: "research", userId: l.user_id, date: l.created_at,
        searchText: `${formatDetails(l.details)} ${l.activity_type} research chat`,
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
    for (const m of mailLogs) {
      list.push({
        id: m.id, kind: "mail", userId: m.sender_id, date: m.created_at,
        searchText: `${m.subject} ${m.body}`,
        raw: m,
      });
    }
    return list;
  }, [standardLogs, researchLogs, apiLogs, contentVersions, chatLogs, mailLogs]);

  // Unique users for dropdown
  const uniqueUsers = useMemo(() => {
    const ids = new Set<string>();
    for (const l of allUnified) {
      if (l.userId) ids.add(l.userId);
      if (l.kind === "chat") ids.add((l.raw as ChatMsg).receiver_id);
      if (l.kind === "mail") ids.add((l.raw as MailMsg).recipient_id);
    }
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
      if (filterUser) {
        const matchesUser = l.userId === filterUser;
        const matchesChatReceiver = l.kind === "chat" && (l.raw as ChatMsg).receiver_id === filterUser;
        const matchesMailRecipient = l.kind === "mail" && (l.raw as MailMsg).recipient_id === filterUser;
        const matchesContentAuthor = l.kind === "content" && (l.raw as ContentVersion).author.toLowerCase().includes((profileMap[filterUser] || "").toLowerCase());
        if (!matchesUser && !matchesChatReceiver && !matchesMailRecipient && !matchesContentAuthor) return false;
      }
      if (lowerSearch) {
        const userNameStr = userName(l.userId).toLowerCase();
        if (!l.searchText.toLowerCase().includes(lowerSearch) && !userNameStr.includes(lowerSearch)) return false;
      }
      const logDate = new Date(l.date);
      if (fromDate && logDate < fromDate) return false;
      if (toDate && logDate > toDate) return false;
      return true;
    });
  }, [allUnified, filterUser, filterSearch, filterDateFrom, filterDateTo, profileMap]);

  const fActivity = filtered.filter(l => l.kind === "activity").map(l => l.raw as ActivityLog);
  const fApi = filtered.filter(l => l.kind === "api").map(l => l.raw as ApiLog);
  const fContent = filtered.filter(l => l.kind === "content").map(l => l.raw as ContentVersion);
  const fChat = filtered.filter(l => l.kind === "chat").map(l => l.raw as ChatMsg);
  const fMail = filtered.filter(l => l.kind === "mail").map(l => l.raw as MailMsg);
  const fResearch = filtered.filter(l => l.kind === "research").map(l => l.raw as ActivityLog);

  const hasFilters = filterUser || filterSearch || filterDateFrom || filterDateTo;
  const clearFilters = () => { setFilterUser(""); setFilterSearch(""); setFilterDateFrom(""); setFilterDateTo(""); };

  const categories: Array<{ id: LogCategory; label: string; emoji: string }> = [
    { id: "all", label: "All", emoji: "📋" },
    { id: "page_view", label: "Page Views", emoji: "👁️" },
    { id: "map_view", label: "Map Access", emoji: "🗺️" },
    { id: "api", label: "API Calls", emoji: "🔑" },
    { id: "content", label: "Content Changes", emoji: "📝" },
    { id: "chat", label: "IM Chat", emoji: "💬" },
    { id: "mail", label: "Mail", emoji: "📧" },
    { id: "research", label: "Research Chat", emoji: "🤖" },
  ];

  // Stats summary
  const statCounts = useMemo(() => ({
    activity: fActivity.length,
    api: fApi.length,
    content: fContent.length,
    chat: fChat.length,
    mail: fMail.length,
    research: fResearch.length,
    total: filtered.length,
  }), [fActivity, fApi, fContent, fChat, fMail, fResearch, filtered]);

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

      {/* Stats bar */}
      {category === "all" && !loading && (
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-1.5 mb-2 flex gap-3 flex-wrap text-[9px]">
          <span>📊 <b>{statCounts.total}</b> total</span>
          <span>👁️ <b>{statCounts.activity}</b> views</span>
          <span>🔑 <b>{statCounts.api}</b> API</span>
          <span>📝 <b>{statCounts.content}</b> edits</span>
          <span>💬 <b>{statCounts.chat}</b> IMs</span>
          <span>📧 <b>{statCounts.mail}</b> mails</span>
          <span>🤖 <b>{statCounts.research}</b> research</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 mb-3">
        <div className="flex gap-2 flex-wrap items-end">
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

          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] font-bold">📅 From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="win98-input text-[9px] w-[110px]"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] font-bold">📅 To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="win98-input text-[9px] w-[110px]"
            />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="win98-button text-[9px] px-2 py-0.5 flex items-center gap-0.5" title="Clear filters">
              <X className="h-2.5 w-2.5" /> Clear
            </button>
          )}
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
                    <th className="px-1 py-1 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {fActivity.map(log => (
                    <tr key={log.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer" onClick={() => setDetail({ kind: "activity", data: log })}>
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
                      <td className="px-1 py-1">
                        <Eye className="h-3 w-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    <th className="px-1 py-1 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {fApi.map(log => (
                    <tr key={log.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer" onClick={() => setDetail({ kind: "api", data: log })}>
                      <td className="px-2 py-1 font-bold">{userName(log.user_id)}</td>
                      <td className="px-2 py-1 font-mono">{log.endpoint}</td>
                      <td className="px-2 py-1">
                        <span className={`px-1 py-0 win98-sunken text-[8px] font-bold ${log.status_code < 400 ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}`}>
                          {log.status_code}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">{fmtDate(log.created_at)}</td>
                      <td className="px-1 py-1">
                        <Eye className="h-3 w-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    <th className="px-1 py-1 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {fContent.map(v => (
                    <tr key={v.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer" onClick={() => setDetail({ kind: "content", data: v })}>
                      <td className="px-2 py-1 font-bold">{v.author}</td>
                      <td className="px-2 py-1 font-mono">{v.github_path.split("/").pop()}</td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">{v.commit_message}</td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">{fmtDate(v.commit_date)}</td>
                      <td className="px-1 py-1">
                        <Eye className="h-3 w-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </LogSection>
          )}

          {fChat.length > 0 && (
            <LogSection title="💬 IM Chat Logs" count={fChat.length}>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                    <th className="text-left px-2 py-1 font-bold">From</th>
                    <th className="text-left px-2 py-1 font-bold">To</th>
                    <th className="text-left px-2 py-1 font-bold">Message</th>
                    <th className="text-left px-2 py-1 font-bold">Status</th>
                    <th className="text-left px-2 py-1 font-bold">Time</th>
                    <th className="px-1 py-1 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {fChat.map(msg => (
                    <tr key={msg.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer" onClick={() => setDetail({ kind: "chat", data: msg })}>
                      <td className="px-2 py-1 font-bold">{userName(msg.sender_id)}</td>
                      <td className="px-2 py-1">{userName(msg.receiver_id)}</td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))] truncate max-w-[250px]">{msg.content}</td>
                      <td className="px-2 py-1">
                        <span className={`px-1 py-0 win98-sunken text-[8px] font-bold ${msg.read_at ? "text-green-700 bg-green-50" : "text-orange-700 bg-orange-50"}`}>
                          {msg.read_at ? "✅ Read" : "📩 Unread"}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">{fmtDate(msg.created_at)}</td>
                      <td className="px-1 py-1">
                        <Eye className="h-3 w-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </LogSection>
          )}

          {fMail.length > 0 && (
            <LogSection title="📧 Mail Logs" count={fMail.length}>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                    <th className="text-left px-2 py-1 font-bold">From</th>
                    <th className="text-left px-2 py-1 font-bold">To</th>
                    <th className="text-left px-2 py-1 font-bold">Subject</th>
                    <th className="text-left px-2 py-1 font-bold">Status</th>
                    <th className="text-left px-2 py-1 font-bold">Time</th>
                    <th className="px-1 py-1 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {fMail.map(msg => (
                    <tr key={msg.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer" onClick={() => setDetail({ kind: "mail", data: msg })}>
                      <td className="px-2 py-1 font-bold">{userName(msg.sender_id)}</td>
                      <td className="px-2 py-1">{userName(msg.recipient_id)}</td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">{msg.subject || "(no subject)"}</td>
                      <td className="px-2 py-1">
                        <span className={`px-1 py-0 win98-sunken text-[8px] font-bold ${msg.read_at ? "text-green-700 bg-green-50" : msg.deleted_by_recipient ? "text-red-700 bg-red-50" : "text-orange-700 bg-orange-50"}`}>
                          {msg.deleted_by_recipient ? "🗑️ Del" : msg.read_at ? "✅ Read" : "📩 New"}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">{fmtDate(msg.created_at)}</td>
                      <td className="px-1 py-1">
                        <Eye className="h-3 w-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </LogSection>
          )}

          {fResearch.length > 0 && (
            <LogSection title="🤖 Research Assistant / Ask Jeeves" count={fResearch.length}>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                    <th className="text-left px-2 py-1 font-bold">User</th>
                    <th className="text-left px-2 py-1 font-bold">Type</th>
                    <th className="text-left px-2 py-1 font-bold">Details</th>
                    <th className="text-left px-2 py-1 font-bold">Time</th>
                    <th className="px-1 py-1 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {fResearch.map(log => (
                    <tr key={log.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer" onClick={() => setDetail({ kind: "research", data: log })}>
                      <td className="px-2 py-1 font-bold">{userName(log.user_id)}</td>
                      <td className="px-2 py-1">
                        <span className="px-1 py-0 win98-sunken text-[8px] font-bold text-purple-700 bg-purple-50">
                          {log.activity_type === "chat_send" ? "🤖 chat" : "⚡ api"}
                        </span>
                      </td>
                      <td className="px-2 py-1 font-mono text-[hsl(var(--muted-foreground))] truncate max-w-[250px]">
                        {formatDetails(log.details)}
                      </td>
                      <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">{fmtDate(log.created_at)}</td>
                      <td className="px-1 py-1">
                        <Eye className="h-3 w-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </LogSection>
          )}

          {fActivity.length === 0 && fApi.length === 0 && fContent.length === 0 && fChat.length === 0 && fMail.length === 0 && fResearch.length === 0 && (
            <div className="text-center py-8 text-[10px] text-[hsl(var(--muted-foreground))]">
              📭 No logs found{hasFilters ? " matching your filters" : " for this category"}.
            </div>
          )}
        </div>
      )}

      {/* Detail Mini-Window */}
      {detail && (
        <Win98Window
          title={detailWindowTitle(detail)}
          icon={detailWindowIcon(detail)}
          onClose={() => setDetail(null)}
          defaultSize={{ width: 560, height: 450 }}
          defaultPosition={{ x: 120, y: 60 }}
          minSize={{ width: 320, height: 200 }}
          statusBar={<span className="text-[9px] text-[hsl(var(--muted-foreground))]">Log ID: {detail.data.id.slice(0, 8)}…</span>}
        >
          <div className="p-3 overflow-y-auto h-full bg-white text-[10px] space-y-3">
            {detail.kind === "activity" && <ActivityDetailView log={detail.data} userName={userName} fmtDate={fmtDateLong} />}
            {detail.kind === "api" && <ApiDetailView log={detail.data} userName={userName} fmtDate={fmtDateLong} />}
            {detail.kind === "content" && <ContentDetailView version={detail.data} fmtDate={fmtDateLong} />}
            {detail.kind === "chat" && <ChatDetailView msg={detail.data} userName={userName} fmtDate={fmtDateLong} />}
            {detail.kind === "mail" && <MailDetailView msg={detail.data as unknown as MailMsg} userName={userName} fmtDate={fmtDateLong} />}
            {detail.kind === "research" && <ResearchDetailView log={detail.data} userName={userName} fmtDate={fmtDateLong} />}
          </div>
        </Win98Window>
      )}
    </div>
  );
}

// ─── Detail Window Helpers ─────────────────────────────────────────────────

function detailWindowTitle(detail: DetailItem): string {
  switch (detail.kind) {
    case "activity": return `Activity Detail — ${(detail.data as ActivityLog).activity_type}`;
    case "api": return `API Request — ${(detail.data as ApiLog).endpoint}`;
    case "content": return `Content Change — ${(detail.data as ContentVersion).github_path.split("/").pop()}`;
    case "chat": return `IM Chat Message`;
    case "mail": return `Mail — ${(detail.data as unknown as MailMsg).subject || "(no subject)"}`;
    case "research": return `Research Chat — ${(detail.data as ActivityLog).activity_type}`;
  }
}

function detailWindowIcon(detail: DetailItem) {
  switch (detail.kind) {
    case "activity": return <Eye className="h-3.5 w-3.5" />;
    case "api": return <Key className="h-3.5 w-3.5" />;
    case "content": return <FileText className="h-3.5 w-3.5" />;
    case "chat": return <MessageSquare className="h-3.5 w-3.5" />;
    case "mail": return <Mail className="h-3.5 w-3.5" />;
    case "research": return <Bot className="h-3.5 w-3.5" />;
  }
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex gap-2 py-1 border-b border-[hsl(var(--border))]">
      <span className="text-[hsl(var(--muted-foreground))] font-bold min-w-[110px] shrink-0">{label}</span>
      <span className={mono ? "font-mono break-all" : "break-words"}>{value || "—"}</span>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold mb-1 pb-0.5 border-b-2 border-[hsl(var(--border))]">{title}</div>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

function formatTimeDiff(from: string, to: string): string {
  const diff = new Date(to).getTime() - new Date(from).getTime();
  if (diff < 0) return "—";
  if (diff < 60000) return `${Math.round(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ${Math.round((diff % 60000) / 1000)}s`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ${Math.round((diff % 3600000) / 60000)}m`;
  return `${Math.floor(diff / 86400000)}d ${Math.floor((diff % 86400000) / 3600000)}h`;
}

// ─── Activity Detail ───────────────────────────────────────────────────────

function ActivityDetailView({ log, userName, fmtDate }: { log: ActivityLog; userName: (id: string) => string; fmtDate: (d: string) => string }) {
  const details = log.details || {};
  const detailKeys = Object.keys(details);
  const knownKeys = ["page", "map_type", "section", "district", "state", "candidate", "slug", "query", "tab", "filter", "country", "region", "source"];
  const extraKeys = detailKeys.filter(k => !knownKeys.includes(k));

  return (
    <>
      <DetailSection title="📋 Event Information">
        <DetailRow label="Event Type" value={
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.activity_type === "map_view" ? "bg-blue-100 text-blue-800" : log.activity_type === "page_view" ? "bg-green-100 text-green-800" : log.activity_type === "content_edit" ? "bg-yellow-100 text-yellow-800" : log.activity_type === "chat_send" ? "bg-purple-100 text-purple-800" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"}`}>
            {log.activity_type.replace(/_/g, " ").toUpperCase()}
          </span>
        } />
        <DetailRow label="Timestamp" value={fmtDate(log.created_at)} />
        <DetailRow label="Log ID" value={log.id} mono />
        <DetailRow label="Relative Time" value={formatTimeDiff(log.created_at, new Date().toISOString()) + " ago"} />
      </DetailSection>

      <DetailSection title="👤 User">
        <DetailRow label="Display Name" value={userName(log.user_id)} />
        <DetailRow label="User ID" value={log.user_id} mono />
      </DetailSection>

      <DetailSection title="📄 Event Details">
        {details.page && <DetailRow label="Page" value={String(details.page)} />}
        {details.map_type && <DetailRow label="Map Type" value={String(details.map_type)} />}
        {details.section && <DetailRow label="Section" value={String(details.section)} />}
        {details.district && <DetailRow label="District" value={String(details.district)} />}
        {details.state && <DetailRow label="State" value={String(details.state)} />}
        {details.candidate && <DetailRow label="Candidate" value={String(details.candidate)} />}
        {details.slug && <DetailRow label="Slug" value={String(details.slug)} mono />}
        {details.query && <DetailRow label="Query" value={String(details.query)} />}
        {details.tab && <DetailRow label="Tab" value={String(details.tab)} />}
        {details.filter && <DetailRow label="Filter" value={String(details.filter)} />}
        {details.country && <DetailRow label="Country" value={String(details.country)} />}
        {details.region && <DetailRow label="Region" value={String(details.region)} />}
        {details.source && <DetailRow label="Source" value={String(details.source)} />}
        {extraKeys.map(k => (
          <DetailRow key={k} label={k} value={typeof details[k] === "object" ? JSON.stringify(details[k]) : String(details[k])} />
        ))}
      </DetailSection>

      <DetailSection title="🔍 Raw Data">
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 mt-1 overflow-x-auto">
          <pre className="text-[8px] font-mono whitespace-pre-wrap break-all">{JSON.stringify(details, null, 2)}</pre>
        </div>
      </DetailSection>
    </>
  );
}

// ─── API Detail ────────────────────────────────────────────────────────────

function ApiDetailView({ log, userName, fmtDate }: { log: ApiLog; userName: (id: string) => string; fmtDate: (d: string) => string }) {
  const isSuccess = log.status_code < 400;
  const endpointParts = log.endpoint.split("/").filter(Boolean);
  const method = endpointParts.length > 0 ? endpointParts[endpointParts.length - 1] : log.endpoint;

  return (
    <>
      <DetailSection title="🔑 API Request Information">
        <DetailRow label="Endpoint" value={<span className="font-mono font-bold">{log.endpoint}</span>} />
        <DetailRow label="Resource" value={method} />
        <DetailRow label="Status Code" value={
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isSuccess ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {log.status_code} {statusCodeLabel(log.status_code)}
          </span>
        } />
        <DetailRow label="Timestamp" value={fmtDate(log.created_at)} />
        <DetailRow label="Relative Time" value={formatTimeDiff(log.created_at, new Date().toISOString()) + " ago"} />
        <DetailRow label="Request ID" value={log.id} mono />
      </DetailSection>

      <DetailSection title="👤 User">
        <DetailRow label="Display Name" value={userName(log.user_id)} />
        <DetailRow label="User ID" value={log.user_id} mono />
      </DetailSection>

      <DetailSection title="🔐 API Key">
        <DetailRow label="API Key ID" value={log.api_key_id} mono />
      </DetailSection>

      <DetailSection title="📊 Response Analysis">
        <DetailRow label="Outcome" value={isSuccess ? "✅ Successful" : "❌ Failed"} />
        <DetailRow label="HTTP Category" value={
          log.status_code < 200 ? "1xx Informational" :
          log.status_code < 300 ? "2xx Success" :
          log.status_code < 400 ? "3xx Redirect" :
          log.status_code < 500 ? "4xx Client Error" :
          "5xx Server Error"
        } />
        <DetailRow label="Severity" value={
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
            log.status_code < 300 ? "bg-green-100 text-green-800" :
            log.status_code < 400 ? "bg-yellow-100 text-yellow-800" :
            log.status_code < 500 ? "bg-orange-100 text-orange-800" :
            "bg-red-100 text-red-800"
          }`}>
            {log.status_code < 300 ? "Normal" : log.status_code < 400 ? "Warning" : log.status_code < 500 ? "Client Error" : "Server Error"}
          </span>
        } />
      </DetailSection>
    </>
  );
}

// ─── Content Change Detail ─────────────────────────────────────────────────

function ContentDetailView({ version, fmtDate }: { version: ContentVersion; fmtDate: (d: string) => string }) {
  const fileName = version.github_path.split("/").pop() || version.github_path;
  const dirPath = version.github_path.split("/").slice(0, -1).join("/") || "/";
  const contentPreview = version.content ? version.content.slice(0, 3000) : "";
  const contentLength = version.content?.length || 0;
  const lineCount = version.content?.split("\n").length || 0;
  const wordCount = version.content?.split(/\s+/).filter(Boolean).length || 0;

  return (
    <>
      <DetailSection title="📝 Commit Information">
        <DetailRow label="Commit Message" value={version.commit_message || "No message"} />
        <DetailRow label="Commit Date" value={fmtDate(version.commit_date)} />
        <DetailRow label="Relative Time" value={formatTimeDiff(version.commit_date, new Date().toISOString()) + " ago"} />
        <DetailRow label="Commit SHA" value={version.commit_sha || "—"} mono />
        <DetailRow label="Version ID" value={version.id} mono />
      </DetailSection>

      <DetailSection title="👤 Author">
        <DetailRow label="Name" value={version.author || "Unknown"} />
      </DetailSection>

      <DetailSection title="📂 File Information">
        <DetailRow label="File Name" value={<span className="font-bold">{fileName}</span>} />
        <DetailRow label="Full Path" value={version.github_path} mono />
        <DetailRow label="Directory" value={dirPath} mono />
        <DetailRow label="Content Size" value={`${contentLength.toLocaleString()} chars · ${lineCount.toLocaleString()} lines · ${wordCount.toLocaleString()} words`} />
      </DetailSection>

      {contentPreview && (
        <DetailSection title="📄 Content Preview">
          <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 mt-1 overflow-x-auto max-h-[200px] overflow-y-auto">
            <pre className="text-[8px] font-mono whitespace-pre-wrap break-words">{contentPreview}{contentLength > 3000 ? "\n\n… (truncated)" : ""}</pre>
          </div>
        </DetailSection>
      )}
    </>
  );
}

// ─── Chat Detail ───────────────────────────────────────────────────────────

function ChatDetailView({ msg, userName, fmtDate }: { msg: ChatMsg; userName: (id: string) => string; fmtDate: (d: string) => string }) {
  const msgLength = msg.content?.length || 0;
  const wordCount = msg.content?.split(/\s+/).filter(Boolean).length || 0;

  return (
    <>
      <DetailSection title="💬 IM Message Information">
        <DetailRow label="Channel" value="AOL Instant Messenger" />
        <DetailRow label="Sent At" value={fmtDate(msg.created_at)} />
        <DetailRow label="Relative Time" value={formatTimeDiff(msg.created_at, new Date().toISOString()) + " ago"} />
        <DetailRow label="Read At" value={msg.read_at ? fmtDate(msg.read_at) : <span className="text-orange-600 font-bold">Unread</span>} />
        <DetailRow label="Message ID" value={msg.id} mono />
        <DetailRow label="Status" value={
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${msg.read_at ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}>
            {msg.read_at ? "✅ Read" : "📩 Unread"}
          </span>
        } />
      </DetailSection>

      <DetailSection title="👤 Participants">
        <DetailRow label="From (Sender)" value={
          <span><span className="font-bold">{userName(msg.sender_id)}</span> <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">({msg.sender_id.slice(0, 12)}…)</span></span>
        } />
        <DetailRow label="To (Recipient)" value={
          <span><span className="font-bold">{userName(msg.receiver_id)}</span> <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">({msg.receiver_id.slice(0, 12)}…)</span></span>
        } />
      </DetailSection>

      <DetailSection title="📄 Message Content">
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-3 mt-1">
          <div className="text-[10px] leading-relaxed whitespace-pre-wrap break-words">{msg.content || "(empty message)"}</div>
        </div>
        <DetailRow label="Length" value={`${msgLength} chars · ${wordCount} words`} />
      </DetailSection>

      <DetailSection title="⏱️ Timing Analysis">
        <DetailRow label="Sent" value={fmtDate(msg.created_at)} />
        {msg.read_at && (
          <>
            <DetailRow label="Read" value={fmtDate(msg.read_at)} />
            <DetailRow label="Read Delay" value={formatTimeDiff(msg.created_at, msg.read_at)} />
          </>
        )}
      </DetailSection>
    </>
  );
}

// ─── Mail Detail ───────────────────────────────────────────────────────────

function MailDetailView({ msg, userName, fmtDate }: { msg: MailMsg; userName: (id: string) => string; fmtDate: (d: string) => string }) {
  const bodyLength = msg.body?.length || 0;
  const wordCount = msg.body?.split(/\s+/).filter(Boolean).length || 0;

  return (
    <>
      <DetailSection title="📧 Mail Message Information">
        <DetailRow label="Channel" value="AOL Mail" />
        <DetailRow label="Subject" value={<span className="font-bold">{msg.subject || "(no subject)"}</span>} />
        <DetailRow label="Sent At" value={fmtDate(msg.created_at)} />
        <DetailRow label="Relative Time" value={formatTimeDiff(msg.created_at, new Date().toISOString()) + " ago"} />
        <DetailRow label="Message ID" value={msg.id} mono />
      </DetailSection>

      <DetailSection title="👤 Participants">
        <DetailRow label="From (Sender)" value={
          <span><span className="font-bold">{userName(msg.sender_id)}</span> <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">({msg.sender_id.slice(0, 12)}…)</span></span>
        } />
        <DetailRow label="To (Recipient)" value={
          <span><span className="font-bold">{userName(msg.recipient_id)}</span> <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">({msg.recipient_id.slice(0, 12)}…)</span></span>
        } />
      </DetailSection>

      <DetailSection title="📊 Status & Delivery">
        <DetailRow label="Read Status" value={
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${msg.read_at ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}>
            {msg.read_at ? "✅ Read" : "📩 Unread"}
          </span>
        } />
        {msg.read_at && <DetailRow label="Read At" value={fmtDate(msg.read_at)} />}
        {msg.read_at && <DetailRow label="Read Delay" value={formatTimeDiff(msg.created_at, msg.read_at)} />}
        <DetailRow label="Deleted by Sender" value={
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${msg.deleted_by_sender ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
            {msg.deleted_by_sender ? "🗑️ Yes" : "✅ No"}
          </span>
        } />
        <DetailRow label="Deleted by Recipient" value={
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${msg.deleted_by_recipient ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
            {msg.deleted_by_recipient ? "🗑️ Yes" : "✅ No"}
          </span>
        } />
      </DetailSection>

      <DetailSection title="📄 Message Body">
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-3 mt-1 max-h-[200px] overflow-y-auto">
          <div className="text-[10px] leading-relaxed whitespace-pre-wrap break-words">{msg.body || "(empty body)"}</div>
        </div>
        <DetailRow label="Body Size" value={`${bodyLength.toLocaleString()} chars · ${wordCount.toLocaleString()} words`} />
      </DetailSection>
    </>
  );
}

// ─── Research Chat Detail ──────────────────────────────────────────────────

function ResearchDetailView({ log, userName, fmtDate }: { log: ActivityLog; userName: (id: string) => string; fmtDate: (d: string) => string }) {
  const details = log.details || {};
  const detailKeys = Object.keys(details);

  return (
    <>
      <DetailSection title="🤖 Research Assistant / Ask Jeeves">
        <DetailRow label="Channel" value={
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
            {log.activity_type === "chat_send" ? "💬 Research Chat" : "⚡ Research API Call"}
          </span>
        } />
        <DetailRow label="Event Type" value={log.activity_type.replace(/_/g, " ").toUpperCase()} />
        <DetailRow label="Timestamp" value={fmtDate(log.created_at)} />
        <DetailRow label="Relative Time" value={formatTimeDiff(log.created_at, new Date().toISOString()) + " ago"} />
        <DetailRow label="Log ID" value={log.id} mono />
      </DetailSection>

      <DetailSection title="👤 User">
        <DetailRow label="Display Name" value={userName(log.user_id)} />
        <DetailRow label="User ID" value={log.user_id} mono />
      </DetailSection>

      <DetailSection title="📄 Interaction Details">
        {details.query && <DetailRow label="Query / Prompt" value={String(details.query)} />}
        {details.message && <DetailRow label="Message" value={String(details.message)} />}
        {details.model && <DetailRow label="AI Model" value={String(details.model)} />}
        {details.tokens && <DetailRow label="Tokens Used" value={String(details.tokens)} />}
        {details.response_time && <DetailRow label="Response Time" value={`${details.response_time}ms`} />}
        {details.action && <DetailRow label="Action" value={String(details.action)} />}
        {details.candidate && <DetailRow label="Candidate" value={String(details.candidate)} />}
        {details.slug && <DetailRow label="Slug" value={String(details.slug)} mono />}
        {details.page && <DetailRow label="Page Context" value={String(details.page)} />}
        {detailKeys.filter(k => !["query", "message", "model", "tokens", "response_time", "action", "candidate", "slug", "page"].includes(k)).map(k => (
          <DetailRow key={k} label={k} value={typeof details[k] === "object" ? JSON.stringify(details[k]) : String(details[k])} />
        ))}
      </DetailSection>

      <DetailSection title="🔍 Raw Event Data">
        <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 mt-1 overflow-x-auto">
          <pre className="text-[8px] font-mono whitespace-pre-wrap break-all">{JSON.stringify(details, null, 2)}</pre>
        </div>
      </DetailSection>
    </>
  );
}

// ─── Shared Components ─────────────────────────────────────────────────────

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
  if (details.query) parts.push(`query: ${details.query}`);
  if (details.message) parts.push(`msg: ${String(details.message).slice(0, 60)}`);
  if (details.action) parts.push(`action: ${details.action}`);
  if (parts.length === 0) return JSON.stringify(details);
  return parts.join(" · ");
}

function statusCodeLabel(code: number): string {
  const labels: Record<number, string> = {
    200: "OK", 201: "Created", 204: "No Content",
    301: "Moved", 302: "Found", 304: "Not Modified",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 405: "Method Not Allowed", 409: "Conflict",
    422: "Unprocessable", 429: "Rate Limited",
    500: "Server Error", 502: "Bad Gateway", 503: "Unavailable",
  };
  return labels[code] || (code < 300 ? "OK" : code < 400 ? "Redirect" : code < 500 ? "Client Error" : "Server Error");
}
