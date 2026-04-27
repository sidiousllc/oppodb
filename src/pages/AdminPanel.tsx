import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { insertContent, updateContent, deleteContent } from "@/lib/contentAdmin";
import { listUsers, setUserRole, deleteUser, createUser, updateUser, resetUserPassword, banUser, unbanUser, type AdminUser } from "@/lib/adminApi";
import { Users, FileText, Globe, AlertTriangle, BookOpen, Shield, Trash2, Plus, Save, X, Edit3, Loader2, KeyRound, Pencil, Ban, ShieldCheck, RefreshCw, Upload, Download, Clock } from "lucide-react";
import { RoleGroupsTab } from "@/components/RoleGroupsTab";
import { AccessControlTab } from "@/components/AccessControlTab";
import { ActivityLogsTab } from "@/components/ActivityLogsTab";
import { SectionPermissionsTab } from "@/components/SectionPermissionsTab";
import { AdminUserWindow } from "@/components/AdminUserWindow";
import { AdminRoleGroupWindow } from "@/components/AdminRoleGroupWindow";
import { DeviceTrackingTab } from "@/components/DeviceTrackingTab";
import { Phase5AdminTab } from "@/components/Phase5AdminTab";
import { SpeedInsightsStatusTab } from "@/components/SpeedInsightsStatusTab";
import { DesktopIconsTab } from "@/components/DesktopIconsTab";
import LocalFeedsValidation from "@/pages/LocalFeedsValidation";
import LocalFeedsAudit from "@/pages/LocalFeedsAudit";
import LocalFeedsStateSources from "@/pages/LocalFeedsStateSources";
import { toast } from "sonner";
import { Win98PageLayout } from "@/components/Win98PageLayout";

type Tab = "users" | "roles" | "access" | "permissions" | "desktop-icons" | "logs" | "devices" | "intel-ops" | "speed-insights" | "candidates" | "maga" | "local" | "narratives" | "messaging" | "docs" | "international" | "local-feeds";

interface ContentItem {
  id: string;
  name?: string;
  state?: string;
  slug: string;
  content: string;
  summary?: string;
  tags?: string[];
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isModerator, canManageContent, loading: roleLoading } = useUserRole();
  const [tab, setTab] = useState<Tab>("users");

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[hsl(var(--background))]">
        <span className="text-[11px]">Loading...</span>
      </div>
    );
  }

  if (!isAdmin && !isModerator) {
    return (
      <Win98PageLayout title="Access Denied" icon="🛑" addressUrl="aol://ordb.research/admin">
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🚫</div>
          <p className="text-[11px] font-bold mb-2">Access Denied</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">You need admin or moderator privileges.</p>
          <button onClick={() => navigate("/")} className="win98-button text-[10px] mt-4">← Back to Dashboard</button>
        </div>
      </Win98PageLayout>
    );
  }

  const adminTabs = [
    { id: "users" as Tab, label: "Users", emoji: "👥" },
    { id: "roles" as Tab, label: "Role Groups", emoji: "🛡️" },
    { id: "access" as Tab, label: "Access Control", emoji: "🔑" },
    { id: "permissions" as Tab, label: "Permissions", emoji: "🔒" },
    { id: "logs" as Tab, label: "Activity Logs", emoji: "📊" },
    { id: "devices" as Tab, label: "Device Tracking", emoji: "📍" },
    { id: "intel-ops" as Tab, label: "Intel Ops", emoji: "🛰️" },
    { id: "speed-insights" as Tab, label: "Speed Insights", emoji: "⚡" },
    { id: "local-feeds" as Tab, label: "Local Feeds", emoji: "📡" },
    { id: "desktop-icons" as Tab, label: "Desktop Icons", emoji: "🖵" },
  ];

  const contentTabs = [
    { id: "candidates" as Tab, label: "Candidates", emoji: "📋" },
    { id: "maga" as Tab, label: "MAGA Files", emoji: "⚠️" },
    { id: "local" as Tab, label: "Local Impact", emoji: "🌐" },
    { id: "narratives" as Tab, label: "Narratives", emoji: "📄" },
    { id: "messaging" as Tab, label: "Messaging", emoji: "📢" },
    { id: "docs" as Tab, label: "Documentation", emoji: "📖" },
    { id: "international" as Tab, label: "International", emoji: "🌐" },
  ];

  return (
    <Win98PageLayout title="Admin Panel" icon="🛡️" addressUrl="aol://ordb.research/admin">
      {/* User info bar */}
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1 mb-2 flex items-center justify-between text-[10px]">
        <span>Logged in as: <b>{user?.email}</b></span>
        <span className="win98-button px-2 py-0 h-[16px] text-[9px] font-bold">
          {isAdmin ? "🔑 Admin" : "📋 Moderator"}
        </span>
      </div>

      <div className="flex gap-2 h-[calc(100vh-140px)] min-h-0">
        {/* Sidebar */}
        <div className="win98-raised flex flex-col w-44 shrink-0 overflow-y-auto">
          {/* Admin section */}
          <div className="win98-sunken px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold bg-[hsl(var(--win98-face))] sticky top-0 z-10">
            <Shield className="h-3 w-3" /> Admin
          </div>
          <div className="flex flex-col pb-1">
            {adminTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`win98-button text-[10px] flex items-center gap-1.5 px-2 py-1 mx-1 mt-0.5 ${
                  tab === t.id ? "font-bold bg-white" : ""
                }`}
                style={tab === t.id ? {
                  borderBottomColor: "white",
                  marginBottom: "-1px",
                  position: "relative",
                  zIndex: 1,
                } : {}}
              >
                <span>{t.emoji}</span>
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
          {/* Content section */}
          <div className="win98-sunken px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold bg-[hsl(var(--win98-face))] sticky top-0 z-10">
            <FileText className="h-3 w-3" /> Content
          </div>
          <div className="flex flex-col pb-1">
            {contentTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`win98-button text-[10px] flex items-center gap-1.5 px-2 py-1 mx-1 mt-0.5 ${
                  tab === t.id ? "font-bold bg-white" : ""
                }`}
                style={tab === t.id ? {
                  borderBottomColor: "white",
                  marginBottom: "-1px",
                  position: "relative",
                  zIndex: 1,
                } : {}}
              >
                <span>{t.emoji}</span>
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content panel */}
        <div className="flex-1 win98-raised overflow-y-auto bg-white p-3 min-w-0">
          {tab === "users" && isAdmin && <UsersTab />}
          {tab === "roles" && isAdmin && <RoleGroupsTab />}
          {tab === "access" && isAdmin && <AccessControlTab />}
          {tab === "permissions" && isAdmin && <SectionPermissionsTab />}
          {tab === "desktop-icons" && isAdmin && <DesktopIconsTab />}
          {tab === "logs" && isAdmin && <ActivityLogsTab />}
          {tab === "devices" && isAdmin && <DeviceTrackingTab />}
          {tab === "intel-ops" && isAdmin && <Phase5AdminTab />}
          {tab === "speed-insights" && isAdmin && <SpeedInsightsStatusTab />}
          {tab === "local-feeds" && isAdmin && <LocalFeedsTab />}
          {tab === "candidates" && <CandidatesTab />}
          {tab === "maga" && <ContentTab table="maga_files" nameField="name" />}
          {tab === "local" && <ContentTab table="local_impacts" nameField="state" hasState hasSummary />}
          {tab === "narratives" && <ContentTab table="narrative_reports" nameField="name" />}
          {tab === "messaging" && <MessagingGuidanceTab />}
          {tab === "international" && <InternationalTab />}
          {tab === "docs" && <WikiPagesTab />}
        </div>
      </div>

      {/* Security Badge */}
      <div className="mt-3 flex justify-center">
        <a href="https://app.aikido.dev/audit-report/external/8A4IU23ayEgeSwA0wiLzIWS2/request" target="_blank" rel="noopener noreferrer">
          <img src="/aikido-badge.svg" alt="Aikido Security Audit Report" className="h-8 opacity-70 hover:opacity-100 transition-opacity" />
        </a>
      </div>
    </Win98PageLayout>
  );
}

// ============== UsersTab ==============
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [creating, setCreating] = useState(false);
  const [openUserWindows, setOpenUserWindows] = useState<AdminUser[]>([]);
  const [userGroupMap, setUserGroupMap] = useState<Record<string, Array<{ name: string; color: string }>>>({});
  const [userDeviceMap, setUserDeviceMap] = useState<Record<string, number>>({});

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const u = await listUsers();
      setUsers(u);
      setOpenUserWindows(prev => prev.map(ou => {
        const fresh = u.find(fu => fu.id === ou.id);
        return fresh || ou;
      }));
    } catch (e: any) {
      toast.error("Failed to load users: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGroupMemberships = useCallback(async () => {
    const { data: groups } = await supabase.from("role_groups").select("id, name, color");
    const { data: members } = await supabase.from("role_group_members").select("user_id, group_id");
    if (!groups || !members) return;
    const groupLookup: Record<string, { name: string; color: string }> = {};
    for (const g of groups) groupLookup[g.id] = { name: g.name, color: g.color };
    const map: Record<string, Array<{ name: string; color: string }>> = {};
    for (const m of members) {
      const g = groupLookup[m.group_id];
      if (!g) continue;
      if (!map[m.user_id]) map[m.user_id] = [];
      map[m.user_id].push(g);
    }
    setUserGroupMap(map);
  }, []);

  const loadDeviceCounts = useCallback(async () => {
    const { data } = await supabase.from("user_devices").select("user_id");
    if (!data) return;
    const counts: Record<string, number> = {};
    for (const row of data as Array<{ user_id: string }>) {
      counts[row.user_id] = (counts[row.user_id] || 0) + 1;
    }
    setUserDeviceMap(counts);
  }, []);

  useEffect(() => { loadUsers(); loadGroupMemberships(); loadDeviceCounts(); }, [loadUsers, loadGroupMemberships, loadDeviceCounts]);

  const handleOpenUser = (u: AdminUser) => {
    if (!openUserWindows.some(ou => ou.id === u.id)) {
      setOpenUserWindows(prev => [...prev, u]);
    }
  };

  const handleCloseUserWindow = (userId: string) => {
    setOpenUserWindows(prev => prev.filter(u => u.id !== userId));
  };

  const handleUserUpdated = () => {
    loadUsers();
    loadGroupMemberships();
  };

  const handleCreateUser = async () => {
    const trimmedEmail = newEmail.trim();
    const trimmedPassword = newPassword.trim();
    if (!trimmedEmail || !trimmedPassword) { toast.error("Email and password are required"); return; }
    if (trimmedPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) { toast.error("Please enter a valid email address"); return; }
    setCreating(true);
    try {
      await createUser(trimmedEmail, trimmedPassword, newRole);
      toast.success(`User ${trimmedEmail} created`);
      setNewEmail(""); setNewPassword(""); setNewRole("user"); setShowAddUser(false);
      loadUsers();
    } catch (e: any) { toast.error("Failed: " + e.message); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="text-center py-8 text-[10px]">Loading users...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{users.length} users — click a user to manage</span>
        <button onClick={() => setShowAddUser(!showAddUser)} className="win98-button text-[10px] flex items-center gap-1">
          {showAddUser ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showAddUser ? "Cancel" : "Add User"}
        </button>
      </div>

      {showAddUser && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
          <p className="text-[11px] font-bold mb-2">Create New User</p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className="block text-[10px] font-bold mb-1">Email:</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="win98-input w-full" placeholder="user@example.com" maxLength={255} />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1">Password:</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="win98-input w-full" placeholder="Min 6 chars" maxLength={128} />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1">Role:</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="win98-input w-full">
                <option value="user">User</option>
                <option value="premium">Premium</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button onClick={handleCreateUser} disabled={creating} className="win98-button text-[10px] font-bold disabled:opacity-50">
            {creating ? "Creating..." : "Create User"}
          </button>
        </div>
      )}

      {/* User management windows */}
      {openUserWindows.map((u, idx) => (
        <AdminUserWindow
          key={u.id}
          user={u}
          onClose={() => handleCloseUserWindow(u.id)}
          onUserUpdated={handleUserUpdated}
          windowIndex={idx}
        />
      ))}

      {/* Users table */}
      <div className="win98-sunken bg-white">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
              <th className="text-left px-2 py-1 font-bold">User</th>
              <th className="text-left px-2 py-1 font-bold">Status</th>
              <th className="text-left px-2 py-1 font-bold">Joined</th>
              <th className="text-left px-2 py-1 font-bold">Last Sign In</th>
              <th className="text-left px-2 py-1 font-bold">Roles</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isBanned = u.banned_until && new Date(u.banned_until) > new Date();
              const isOpen = openUserWindows.some(ou => ou.id === u.id);
              return (
              <tr
                key={u.id}
                onClick={() => handleOpenUser(u)}
                className={`border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer ${isBanned ? "opacity-60" : ""} ${isOpen ? "bg-[hsl(var(--win98-light))]" : ""}`}
              >
                <td className="px-2 py-1.5">
                  <div className="font-bold">{u.email}</div>
                  {u.display_name && <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{u.display_name}</div>}
                  {userGroupMap[u.id] && userGroupMap[u.id].length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {userGroupMap[u.id].map(g => (
                        <span key={g.name} className="text-[8px] font-bold px-1 py-0 win98-raised rounded-sm" style={{ backgroundColor: g.color }}>
                          🛡️ {g.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {userDeviceMap[u.id] > 0 && (
                    <div className="mt-0.5">
                      <span
                        className="text-[8px] font-bold px-1 py-0 win98-raised rounded-sm"
                        style={{ backgroundColor: "hsl(200, 70%, 85%)" }}
                        title={`${userDeviceMap[u.id]} device(s) sharing location`}
                      >
                        📍 Location ({userDeviceMap[u.id]})
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {isBanned ? (
                    <span className="text-[9px] font-bold px-1 py-0.5 win98-sunken" style={{ color: "hsl(0, 70%, 45%)", backgroundColor: "hsl(0, 70%, 92%)" }}>
                      🚫 Suspended
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1 py-0.5 win98-sunken" style={{ color: "hsl(140, 60%, 30%)", backgroundColor: "hsl(140, 50%, 90%)" }}>
                      ✓ Active
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}</td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    {["admin", "moderator", "premium"].map(role => {
                      const has = u.roles.includes(role);
                      return (
                        <span key={role}
                          className={`text-[9px] px-1 py-0 ${has ? "font-bold win98-raised" : "opacity-30"}`}
                          style={has ? { backgroundColor: role === "admin" ? "#cce" : role === "premium" ? "#fec" : "#cec" } : {}}
                        >
                          {has ? "✓" : ""}{role}
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Old modals removed — replaced by AdminUserWindow component

// ============== InternationalTab ==============
function InternationalTab() {
  const { isAdmin } = useUserRole();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [filterContinent, setFilterContinent] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, lRes, eRes] = await Promise.all([
      supabase.from("international_profiles").select("*").order("country_name"),
      supabase.from("international_leaders").select("*").order("country_code"),
      supabase.from("international_elections").select("*").order("election_year", { ascending: false }).limit(100),
    ]);
    setProfiles(pRes.data || []);
    setLeaders(lRes.data || []);
    setElections(eRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSyncAll = async () => {
    setSyncing(true);
    const countryCodes = ["US","CA","MX","GB","FR","DE","IT","ES","JP","KR","CN","IN","BR","AR","AU","ZA","NG","EG"];
    let synced = 0;
    for (const code of countryCodes) {
      try {
        await supabase.functions.invoke("international-sync", { body: { country_code: code } });
        synced++;
      } catch { /* continue */ }
    }
    toast.success(`Synced ${synced}/${countryCodes.length} countries`);
    await load();
    setSyncing(false);
  };

  const handleSyncOne = async (code: string) => {
    try {
      await supabase.functions.invoke("international-sync", { body: { country_code: code } });
      toast.success(`Synced ${code}`);
      await load();
    } catch (e: any) {
      toast.error(`Sync failed: ${e.message}`);
    }
  };

  const handleUpdateTags = async (id: string, tags: string[]) => {
    try {
      await updateContent("international_profiles", id, { tags });
      toast.success("Tags updated");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm("Delete this profile?")) return;
    try {
      await deleteContent("international_profiles", id);
      toast.success("Deleted");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  // Collect all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      for (const t of (p.tags || [])) set.add(t);
    }
    return [...set].sort();
  }, [profiles]);

  // Collect all continents
  const continents = useMemo(() => [...new Set(profiles.map((p: any) => p.continent).filter(Boolean))].sort(), [profiles]);

  // Filter profiles
  const filtered = useMemo(() => {
    let list = profiles;
    if (filterContinent) list = list.filter((p: any) => p.continent === filterContinent);
    if (filterTag) list = list.filter((p: any) => p.tags?.includes(filterTag));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p: any) =>
        p.country_name?.toLowerCase().includes(q) ||
        p.country_code?.toLowerCase().includes(q) ||
        p.head_of_state?.toLowerCase().includes(q) ||
        p.ruling_party?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [profiles, filterContinent, filterTag, search]);

  if (loading) return <div className="text-center py-8 text-[10px]">Loading international data…</div>;

  if (editingProfile) {
    return (
      <InternationalProfileEditor
        profile={editingProfile}
        onSave={async (updated) => {
          try {
            await updateContent("international_profiles", updated.id, updated);
            toast.success("Profile updated");
            setEditingProfile(null);
            load();
          } catch (e: any) { toast.error(e.message); }
        }}
        onCancel={() => setEditingProfile(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {filtered.length} profiles • {leaders.length} leaders • {elections.length} elections
        </span>
        <div className="flex gap-1">
          {isAdmin && (
            <button onClick={handleSyncAll} disabled={syncing} className="win98-button text-[10px] flex items-center gap-1">
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Sync Top Countries
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1">
          <label className="text-[9px] font-bold">Continent:</label>
          <select value={filterContinent} onChange={e => setFilterContinent(e.target.value)} className="win98-input text-[10px] py-0.5">
            <option value="">All</option>
            {continents.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[9px] font-bold">Tag:</label>
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="win98-input text-[10px] py-0.5">
            <option value="">All</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="win98-input text-[10px] py-0.5 w-36"
        />
      </div>

      <div className="win98-sunken bg-white max-h-[500px] overflow-y-auto">
        {filtered.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between px-2 py-1.5 border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] text-[10px]">
            <div className="min-w-0 flex-1">
              <div className="font-bold truncate">{p.country_name} <span className="font-normal text-[hsl(var(--muted-foreground))]">({p.country_code})</span></div>
              <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">
                {p.continent} • {p.region || "N/A"} • Pop: {p.population?.toLocaleString() || "N/A"} • {p.government_type || "N/A"}
                {p.head_of_state && ` • ${p.head_of_state}`}
              </div>
              {p.tags?.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap">
                  {p.tags.map((t: string) => (
                    <span key={t} className="text-[8px] px-1 py-0 rounded bg-[hsl(var(--win98-light))] border border-[hsl(var(--border))]">{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0 ml-2">
              <button onClick={() => handleSyncOne(p.country_code)} className="win98-button px-1 py-0 text-[9px]" title="Sync">
                <RefreshCw className="h-2.5 w-2.5" />
              </button>
              <button onClick={() => setEditingProfile(p)} className="win98-button px-1 py-0 text-[9px]" title="Edit">
                <Edit3 className="h-2.5 w-2.5" />
              </button>
              {isAdmin && (
                <button onClick={() => handleDeleteProfile(p.id)} className="win98-button px-1 py-0 text-[9px]" title="Delete">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
            No international profiles found. Click "Sync Top Countries" to fetch data.
          </div>
        )}
      </div>
    </div>
  );
}

// ============== InternationalProfileEditor ==============
function InternationalProfileEditor({ profile, onSave, onCancel }: {
  profile: any; onSave: (p: any) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    ...profile,
    tagsText: (profile.tags || []).join(", "),
    industriesText: (profile.major_industries || []).join(", "),
    languagesText: (profile.official_languages || []).join(", "),
  });

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold">Edit: {form.country_name} ({form.country_code})</span>
        <button onClick={onCancel} className="win98-titlebar-btn">✕</button>
      </div>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Country Name:</label>
            <input value={form.country_name || ""} onChange={e => setForm((f: any) => ({ ...f, country_name: e.target.value }))} className="win98-input w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Continent:</label>
            <select value={form.continent || ""} onChange={e => setForm((f: any) => ({ ...f, continent: e.target.value }))} className="win98-input w-full">
              <option value="">Select…</option>
              {["North America","South America","Europe","Asia","Africa","Oceania"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Region:</label>
            <input value={form.region || ""} onChange={e => setForm((f: any) => ({ ...f, region: e.target.value }))} className="win98-input w-full" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold mb-0.5">Tags (continent, country, sub-region, county, state — comma-separated):</label>
          <input value={form.tagsText} onChange={e => setForm((f: any) => ({ ...f, tagsText: e.target.value }))} className="win98-input w-full" placeholder="Europe, EU, Western Europe, G7, NATO" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Capital:</label>
            <input value={form.capital || ""} onChange={e => setForm((f: any) => ({ ...f, capital: e.target.value }))} className="win98-input w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Currency:</label>
            <input value={form.currency || ""} onChange={e => setForm((f: any) => ({ ...f, currency: e.target.value }))} className="win98-input w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Government Type:</label>
            <input value={form.government_type || ""} onChange={e => setForm((f: any) => ({ ...f, government_type: e.target.value }))} className="win98-input w-full" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Head of State:</label>
            <input value={form.head_of_state || ""} onChange={e => setForm((f: any) => ({ ...f, head_of_state: e.target.value }))} className="win98-input w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Head of Government:</label>
            <input value={form.head_of_government || ""} onChange={e => setForm((f: any) => ({ ...f, head_of_government: e.target.value }))} className="win98-input w-full" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Ruling Party:</label>
            <input value={form.ruling_party || ""} onChange={e => setForm((f: any) => ({ ...f, ruling_party: e.target.value }))} className="win98-input w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Population:</label>
            <input type="number" value={form.population || ""} onChange={e => setForm((f: any) => ({ ...f, population: parseInt(e.target.value) || null }))} className="win98-input w-full" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-0.5">GDP:</label>
            <input type="number" value={form.gdp || ""} onChange={e => setForm((f: any) => ({ ...f, gdp: parseFloat(e.target.value) || null }))} className="win98-input w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-0.5">GDP Per Capita:</label>
            <input type="number" value={form.gdp_per_capita || ""} onChange={e => setForm((f: any) => ({ ...f, gdp_per_capita: parseFloat(e.target.value) || null }))} className="win98-input w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-0.5">Unemployment %:</label>
            <input type="number" step="0.1" value={form.unemployment_rate || ""} onChange={e => setForm((f: any) => ({ ...f, unemployment_rate: parseFloat(e.target.value) || null }))} className="win98-input w-full" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold mb-0.5">Languages (comma-separated):</label>
          <input value={form.languagesText} onChange={e => setForm((f: any) => ({ ...f, languagesText: e.target.value }))} className="win98-input w-full" />
        </div>

        <div>
          <label className="block text-[10px] font-bold mb-0.5">Major Industries (comma-separated):</label>
          <input value={form.industriesText} onChange={e => setForm((f: any) => ({ ...f, industriesText: e.target.value }))} className="win98-input w-full" />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onSave({
              ...form,
              tags: form.tagsText.split(",").map((s: string) => s.trim()).filter(Boolean),
              major_industries: form.industriesText.split(",").map((s: string) => s.trim()).filter(Boolean),
              official_languages: form.languagesText.split(",").map((s: string) => s.trim()).filter(Boolean),
            })}
            className="win98-button text-[10px] font-bold"
          >
            <Save className="h-3 w-3 inline mr-1" /> Save
          </button>
          <button onClick={onCancel} className="win98-button text-[10px]">Cancel</button>
        </div>
      </div>
    </div>
  );
}


// ============== CandidatesTab ==============
function CandidatesTab() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("candidate_profiles").select("id, name, slug, content").eq("is_subpage", false).order("name");
    setItems((data || []) as ContentItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (item: ContentItem) => {
    try {
      if (item.id) {
        await updateContent("candidate_profiles", item.id, { name: item.name, slug: item.slug, content: item.content });
        toast.success("Updated");
      } else {
        await insertContent("candidate_profiles", { name: item.name || "", slug: item.slug, content: item.content, github_path: `candidates/${item.slug}.md` });
        toast.success("Created");
      }
      setEditing(null); setCreating(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this candidate profile?")) return;
    try {
      await deleteContent("candidate_profiles", id);
      toast.success("Deleted"); load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="text-center py-8 text-[10px]">Loading...</div>;

  if (editing || creating) {
    return <ContentEditor item={editing || { id: "", name: "", slug: "", content: "" }} nameLabel="Name" onSave={handleSave} onCancel={() => { setEditing(null); setCreating(false); }} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{items.length} profiles</span>
        <button onClick={() => setCreating(true)} className="win98-button text-[10px] flex items-center gap-1"><Plus className="h-3 w-3" /> Add</button>
      </div>
      <ContentList items={items} onEdit={setEditing} onDelete={handleDelete} nameField="name" />
    </div>
  );
}

// ============== MessagingGuidanceTab ==============
interface MessagingItem {
  id: string;
  title: string;
  slug: string;
  source: string;
  source_url: string | null;
  author: string | null;
  published_date: string | null;
  summary: string;
  content: string;
  issue_areas: string[];
  research_type: string;
}

function MessagingGuidanceTab() {
  const { isAdmin } = useUserRole();
  const [items, setItems] = useState<MessagingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MessagingItem | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("messaging_guidance").select("*").order("published_date", { ascending: false });
    setItems((data || []) as MessagingItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (item: MessagingItem) => {
    const record: Record<string, unknown> = {
      title: item.title,
      slug: item.slug,
      source: item.source || "Navigator Research",
      source_url: item.source_url || null,
      author: item.author || null,
      published_date: item.published_date || null,
      summary: item.summary,
      content: item.content,
      issue_areas: item.issue_areas,
      research_type: item.research_type || "message-guidance",
    };
    try {
      if (item.id) {
        await updateContent("messaging_guidance", item.id, record);
        toast.success("Updated");
      } else {
        await insertContent("messaging_guidance", record);
        toast.success("Created");
      }
      setEditing(null); setCreating(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this messaging guidance?")) return;
    try {
      await deleteContent("messaging_guidance", id);
      toast.success("Deleted"); load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="text-center py-8 text-[10px]">Loading...</div>;

  if (editing || creating) {
    const empty: MessagingItem = { id: "", title: "", slug: "", source: "Navigator Research", source_url: null, author: null, published_date: null, summary: "", content: "", issue_areas: [], research_type: "message-guidance" };
    return <MessagingEditor item={editing || empty} onSave={handleSave} onCancel={() => { setEditing(null); setCreating(false); }} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{items.length} reports</span>
        <button onClick={() => setCreating(true)} className="win98-button text-[10px] flex items-center gap-1"><Plus className="h-3 w-3" /> Add</button>
      </div>
      <div className="win98-sunken bg-white">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-2 py-1.5 border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] text-[10px]">
            <div className="min-w-0">
              <div className="font-bold truncate">{item.title}</div>
              <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">
                {item.source} · {item.published_date ? new Date(item.published_date).toLocaleDateString() : "No date"} · {item.issue_areas?.join(", ") || "No tags"}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => setEditing(item)} className="win98-button px-1 py-0 text-[9px]"><Edit3 className="h-2.5 w-2.5" /></button>
              {isAdmin && <button onClick={() => handleDelete(item.id)} className="win98-button px-1 py-0 text-[9px]"><Trash2 className="h-2.5 w-2.5" /></button>}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="px-2 py-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">No messaging guidance yet.</div>
        )}
      </div>
    </div>
  );
}

function MessagingEditor({ item, onSave, onCancel }: { item: MessagingItem; onSave: (item: MessagingItem) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...item, issueAreasText: item.issue_areas?.join(", ") || "" });
  const isNew = !item.id;

  const autoSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold">{isNew ? "Create New" : "Edit"} Messaging Guidance</span>
        <button onClick={onCancel} className="win98-titlebar-btn">✕</button>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">Title:</label>
            <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value, slug: isNew ? autoSlug(e.target.value) : f.slug }))} className="win98-input w-full" placeholder="Report title" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Slug:</label>
            <input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} className="win98-input w-full" placeholder="url-slug" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">Source:</label>
            <input value={form.source} onChange={(e) => setForm(f => ({ ...f, source: e.target.value }))} className="win98-input w-full" placeholder="Navigator Research" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Author:</label>
            <input value={form.author || ""} onChange={(e) => setForm(f => ({ ...f, author: e.target.value }))} className="win98-input w-full" placeholder="Author name" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Published Date:</label>
            <input type="date" value={form.published_date || ""} onChange={(e) => setForm(f => ({ ...f, published_date: e.target.value }))} className="win98-input w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">Source URL:</label>
            <input value={form.source_url || ""} onChange={(e) => setForm(f => ({ ...f, source_url: e.target.value }))} className="win98-input w-full" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Issue Areas (comma-separated):</label>
            <input value={form.issueAreasText} onChange={(e) => setForm(f => ({ ...f, issueAreasText: e.target.value }))} className="win98-input w-full" placeholder="Immigration, Tariffs, Economy" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">Research Type:</label>
            <select value={form.research_type} onChange={(e) => setForm(f => ({ ...f, research_type: e.target.value }))} className="win98-input w-full">
              <option value="message-guidance">Message Guidance</option>
              <option value="national-survey">National Survey</option>
              <option value="memo">Memo</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold mb-1">Summary:</label>
          <input value={form.summary} onChange={(e) => setForm(f => ({ ...f, summary: e.target.value }))} className="win98-input w-full" placeholder="Brief summary" />
        </div>
        <div>
          <label className="block text-[10px] font-bold mb-1">Content (Markdown):</label>
          <textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} rows={16} className="win98-input w-full font-[monospace] text-[10px]" placeholder="## Big Takeaways..." />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => onSave({ ...form, issue_areas: form.issueAreasText.split(",").map(s => s.trim()).filter(Boolean) })} className="win98-button text-[10px] font-bold">
            <Save className="h-3 w-3 inline mr-1" />{isNew ? "Create" : "Save"}
          </button>
          <button onClick={onCancel} className="win98-button text-[10px]">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============== WikiPagesTab ==============
interface WikiPageItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  sort_order: number;
  published: boolean;
}

interface ChangelogEntry {
  id: string;
  slug: string;
  title: string;
  old_content: string;
  new_content: string;
  change_type: string;
  trigger_method: string;
  created_at: string;
}

function computeDiffStats(oldText: string, newText: string): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const added = newLines.filter(l => !oldSet.has(l)).length;
  const removed = oldLines.filter(l => !newSet.has(l)).length;
  return `+${added} / -${removed} lines`;
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  if (!oldText && newText) {
    return (
      <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 max-h-64 overflow-auto font-[monospace] text-[9px] leading-tight">
        {newText.split("\n").slice(0, 80).map((line, i) => (
          <div key={i} className="text-green-700 dark:text-green-400">+ {line}</div>
        ))}
        {newText.split("\n").length > 80 && <div className="text-[hsl(var(--muted-foreground))]">… {newText.split("\n").length - 80} more lines</div>}
      </div>
    );
  }

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const diffLines: { type: "add" | "remove" | "same"; text: string }[] = [];

  // Simple line-based diff
  const maxLen = Math.max(oldLines.length, newLines.length);
  let oi = 0, ni = 0;
  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      diffLines.push({ type: "same", text: oldLines[oi] });
      oi++; ni++;
    } else if (oi < oldLines.length && !newSet.has(oldLines[oi])) {
      diffLines.push({ type: "remove", text: oldLines[oi] });
      oi++;
    } else if (ni < newLines.length && !oldSet.has(newLines[ni])) {
      diffLines.push({ type: "add", text: newLines[ni] });
      ni++;
    } else {
      // Changed line
      if (oi < oldLines.length) { diffLines.push({ type: "remove", text: oldLines[oi] }); oi++; }
      if (ni < newLines.length) { diffLines.push({ type: "add", text: newLines[ni] }); ni++; }
    }
    if (diffLines.length > 200) break;
  }

  // Collapse unchanged sections
  const collapsed: typeof diffLines = [];
  let sameCount = 0;
  for (const line of diffLines) {
    if (line.type === "same") {
      sameCount++;
      if (sameCount <= 2) collapsed.push(line);
      else if (sameCount === 3) collapsed.push({ type: "same", text: `… (${0} unchanged lines)` });
    } else {
      if (sameCount > 3) {
        collapsed[collapsed.length - 1] = { type: "same", text: `… (${sameCount - 2} unchanged lines)` };
      }
      sameCount = 0;
      collapsed.push(line);
    }
  }
  if (sameCount > 3) {
    collapsed[collapsed.length - 1] = { type: "same", text: `… (${sameCount - 2} unchanged lines)` };
  }

  return (
    <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 max-h-64 overflow-auto font-[monospace] text-[9px] leading-tight">
      {collapsed.length === 0 ? (
        <div className="text-[hsl(var(--muted-foreground))]">No differences</div>
      ) : (
        collapsed.map((line, i) => (
          <div
            key={i}
            className={
              line.type === "add" ? "text-green-700 dark:text-green-400 bg-green-500/10" :
              line.type === "remove" ? "text-red-700 dark:text-red-400 bg-red-500/10" :
              "text-[hsl(var(--muted-foreground))]"
            }
          >
            {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "} {line.text}
          </div>
        ))
      )}
    </div>
  );
}

function WikiPagesTab() {
  const { isAdmin } = useUserRole();
  const [items, setItems] = useState<WikiPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WikiPageItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState<"pull" | "push" | null>(null);
  const [updatingDocs, setUpdatingDocs] = useState(false);
  const [syncMeta, setSyncMeta] = useState<{ last_commit_sha: string | null; last_synced_at: string | null } | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [expandedChange, setExpandedChange] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: pages }, { data: meta }] = await Promise.all([
      supabase.from("wiki_pages").select("*").order("sort_order"),
      supabase.from("sync_metadata").select("last_commit_sha, last_synced_at").eq("id", 1).single(),
    ]);
    setItems((pages || []) as WikiPageItem[]);
    setSyncMeta(meta || null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadChangelog = async () => {
    setChangelogLoading(true);
    const { data } = await supabase
      .from("wiki_changelog")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setChangelog((data || []) as ChangelogEntry[]);
    setChangelogLoading(false);
  };

  const handleSave = async (item: WikiPageItem) => {
    const record: Record<string, unknown> = {
      title: item.title,
      slug: item.slug,
      content: item.content,
      sort_order: item.sort_order,
      published: item.published,
    };
    try {
      if (item.id) {
        await updateContent("wiki_pages", item.id, record);
        toast.success("Updated");
      } else {
        await insertContent("wiki_pages", record);
        toast.success("Created");
      }
      setEditing(null); setCreating(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this wiki page?")) return;
    try {
      await deleteContent("wiki_pages", id);
      toast.success("Deleted"); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSync = async (direction: "pull" | "push") => {
    const confirmMsg = direction === "pull"
      ? "Pull wiki pages from GitHub? This will overwrite local database content with GitHub content."
      : "Push wiki pages to GitHub? This will overwrite GitHub wiki content with database content.";
    if (!confirm(confirmMsg)) return;

    setSyncing(direction);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/wiki-sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ direction }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Sync failed");

      if (direction === "pull") {
        toast.success(`Pulled ${result.imported || 0} pages from GitHub`);
      } else {
        toast.success(`Pushed ${result.pushed || 0} pages to GitHub`);
      }
      await load();
      if (result.errors?.length) {
        toast.warning(`${result.errors.length} error(s) during sync`);
        console.warn("Sync errors:", result.errors);
      }
      // Auto-update documentation after sync
      handleUpdateDocs(true);
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  const handleUpdateDocs = async (silent = false, slugs?: string[]) => {
    setUpdatingDocs(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (!silent) toast.error("Not authenticated"); return; }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/auto-docs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(slugs ? { slugs, trigger_method: "selective" } : { trigger_method: silent ? "auto-sync" : "manual" }),
        }
      );
      const result = await res.json();

      if (!res.ok) {
        if (!silent) toast.error(result.error || "Docs update failed");
        return;
      }

      if (result.updated > 0) {
        toast.success(`Updated ${result.updated} documentation page(s)`);
        await load();
      } else {
        if (!silent) toast.info(result.message || "Documentation is already up to date");
      }

      if (result.newComponents?.length > 0) {
        toast.info(`${result.newComponents.length} new component(s) detected: ${result.newComponents.slice(0, 3).join(", ")}${result.newComponents.length > 3 ? "…" : ""}`);
      }
    } catch (e: any) {
      if (!silent) toast.error(e.message || "Docs update failed");
    } finally {
      setUpdatingDocs(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-[10px]">Loading...</div>;

  if (editing || creating) {
    const empty: WikiPageItem = { id: "", slug: "", title: "", content: "", sort_order: items.length, published: true };
    return <WikiPageEditor item={editing || empty} onSave={handleSave} onCancel={() => { setEditing(null); setCreating(false); }} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{items.length} pages</span>
        <div className="flex gap-1">
          {isAdmin && (
            <>
              <button
                onClick={() => handleSync("pull")}
                disabled={syncing !== null}
                className="win98-button text-[10px] flex items-center gap-1"
                title="Pull from GitHub wiki into database"
              >
                {syncing === "pull" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Pull from GitHub
              </button>
              <button
                onClick={() => handleSync("push")}
                disabled={syncing !== null}
                className="win98-button text-[10px] flex items-center gap-1"
                title="Push database wiki pages to GitHub wiki"
              >
                {syncing === "push" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Push to GitHub
              </button>
              <button
                onClick={() => handleUpdateDocs(false)}
                disabled={syncing !== null || updatingDocs}
                className="win98-button text-[10px] flex items-center gap-1"
                title="Auto-update documentation based on codebase changes"
              >
                {updatingDocs ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                Update Docs
              </button>
            </>
          )}
          <button onClick={() => setCreating(true)} className="win98-button text-[10px] flex items-center gap-1"><Plus className="h-3 w-3" /> Add Page</button>
        </div>
      </div>
      {/* Sync status indicator */}
      {syncMeta && (
        <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1 mb-2 flex items-center justify-between text-[9px] text-[hsl(var(--muted-foreground))]">
          <span>
            🔄 Last synced: {syncMeta.last_synced_at
              ? new Date(syncMeta.last_synced_at).toLocaleString()
              : "Never"}
          </span>
          {syncMeta.last_commit_sha && (
            <span className="font-[monospace]" title={syncMeta.last_commit_sha}>
              SHA: {syncMeta.last_commit_sha.slice(0, 7)}
            </span>
          )}
        </div>
      )}
      <div className="win98-sunken bg-white">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-2 py-1.5 border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] text-[10px]">
            <div className="min-w-0">
              <div className="font-bold truncate">
                {!item.published && <span className="text-[hsl(var(--muted-foreground))]">[Draft] </span>}
                {item.title}
              </div>
              <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">/{item.slug} · #{item.sort_order} · {item.content.length} chars</div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {isAdmin && (
                <button
                  onClick={() => handleUpdateDocs(false, [item.slug])}
                  disabled={updatingDocs}
                  className="win98-button px-1 py-0 text-[9px]"
                  title={`Regenerate docs for ${item.title}`}
                >
                  {updatingDocs ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <BookOpen className="h-2.5 w-2.5" />}
                </button>
              )}
              <button onClick={() => setEditing(item)} className="win98-button px-1 py-0 text-[9px]"><Edit3 className="h-2.5 w-2.5" /></button>
              {isAdmin && <button onClick={() => handleDelete(item.id)} className="win98-button px-1 py-0 text-[9px]"><Trash2 className="h-2.5 w-2.5" /></button>}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="px-2 py-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">No wiki pages yet. Click "Pull from GitHub" to import or add pages manually.</div>
        )}
      </div>

      {/* Changelog section */}
      <div className="mt-3">
        <button
          onClick={() => { setShowChangelog(!showChangelog); if (!showChangelog && changelog.length === 0) loadChangelog(); }}
          className="win98-button text-[10px] flex items-center gap-1 mb-2"
        >
          <Clock className="h-3 w-3" />
          {showChangelog ? "Hide" : "Show"} Changelog
        </button>

        {showChangelog && (
          <div className="win98-sunken bg-white">
            {changelogLoading ? (
              <div className="px-2 py-4 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
                <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Loading changelog…
              </div>
            ) : changelog.length === 0 ? (
              <div className="px-2 py-4 text-center text-[10px] text-[hsl(var(--muted-foreground))]">No documentation changes recorded yet.</div>
            ) : (
              changelog.map(entry => {
                const isExpanded = expandedChange === entry.id;
                return (
                  <div key={entry.id} className="border-b border-[hsl(var(--win98-light))]">
                    <button
                      onClick={() => setExpandedChange(isExpanded ? null : entry.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-[hsl(var(--win98-light))] text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold flex items-center gap-1">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${entry.change_type === "created" ? "bg-green-500" : "bg-amber-500"}`} />
                          {entry.title}
                          <span className="font-normal text-[hsl(var(--muted-foreground))]">/{entry.slug}</span>
                        </div>
                        <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
                          {new Date(entry.created_at).toLocaleString()} · {entry.change_type} · via {entry.trigger_method}
                          {entry.old_content && entry.new_content && (
                            <span> · {computeDiffStats(entry.old_content, entry.new_content)}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] text-[hsl(var(--muted-foreground))] shrink-0 ml-2">{isExpanded ? "▼" : "►"}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-2 pb-2">
                        <DiffView oldText={entry.old_content} newText={entry.new_content} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WikiPageEditor({ item, onSave, onCancel }: { item: WikiPageItem; onSave: (item: WikiPageItem) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...item });
  const isNew = !item.id;
  const autoSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold">{isNew ? "Create New" : "Edit"} Wiki Page</span>
        <button onClick={onCancel} className="win98-titlebar-btn">✕</button>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">Title:</label>
            <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value, slug: isNew ? autoSlug(e.target.value) : f.slug }))} className="win98-input w-full" placeholder="Page title" />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Slug:</label>
            <input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} className="win98-input w-full" placeholder="url-slug" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">Sort Order:</label>
            <input type="number" value={form.sort_order} onChange={(e) => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} className="win98-input w-full" />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-1 text-[10px]">
              <input type="checkbox" checked={form.published} onChange={(e) => setForm(f => ({ ...f, published: e.target.checked }))} />
              <span className="font-bold">Published</span>
            </label>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold mb-1">Content (Markdown):</label>
          <textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} rows={20}
            className="win98-input w-full font-[monospace] text-[10px]" placeholder="# Page Title..." />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => onSave(form)} className="win98-button text-[10px] font-bold">
            <Save className="h-3 w-3 inline mr-1" />{isNew ? "Create" : "Save"}
          </button>
          <button onClick={onCancel} className="win98-button text-[10px]">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============== ContentTab ==============
function ContentTab({ table, nameField, hasState, hasSummary }: { table: string; nameField: string; hasState?: boolean; hasSummary?: boolean }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from(table as "maga_files" | "local_impacts" | "narrative_reports").select("*").order(nameField);
    setItems((data || []) as unknown as ContentItem[]);
    setLoading(false);
  }, [table, nameField]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (item: ContentItem) => {
    const record: any = { slug: item.slug, content: item.content, tags: item.tags || [] };
    if (hasState) { record.state = item.state || item.name; if (hasSummary) record.summary = item.summary || ""; }
    else { record.name = item.name; }
    try {
      if (item.id) {
        await updateContent(table as "maga_files" | "local_impacts" | "narrative_reports", item.id, record);
        toast.success("Updated");
      } else {
        await insertContent(table as "maga_files" | "local_impacts" | "narrative_reports", record);
        toast.success("Created");
      }
      setEditing(null); setCreating(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    try {
      await deleteContent(table as "maga_files" | "local_impacts" | "narrative_reports", id);
      toast.success("Deleted"); load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="text-center py-8 text-[10px]">Loading...</div>;

  if (editing || creating) {
    return <ContentEditor item={editing || { id: "", name: "", state: "", slug: "", content: "", summary: "", tags: [] }} nameLabel={hasState ? "State" : "Name"} hasState={hasState} hasSummary={hasSummary} onSave={handleSave} onCancel={() => { setEditing(null); setCreating(false); }} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{items.length} items</span>
        <button onClick={() => setCreating(true)} className="win98-button text-[10px] flex items-center gap-1"><Plus className="h-3 w-3" /> Add</button>
      </div>
      <ContentList items={items} onEdit={setEditing} onDelete={handleDelete} nameField={nameField} />
    </div>
  );
}

// ============== Shared components ==============
function ContentList({ items, onEdit, onDelete, nameField }: { items: ContentItem[]; onEdit: (item: ContentItem) => void; onDelete: (id: string) => void; nameField: string; }) {
  return (
    <div className="win98-sunken bg-white">
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between px-2 py-1.5 border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] text-[10px]">
          <div className="min-w-0">
            <div className="font-bold truncate">{(item as any)[nameField] || item.slug}</div>
            <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">/{item.slug} · {item.content.length} chars{item.tags && item.tags.length > 0 ? ` · ${item.tags.join(", ")}` : ""}</div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => onEdit(item)} className="win98-button px-1 py-0 text-[9px]"><Edit3 className="h-2.5 w-2.5" /></button>
            <button onClick={() => onDelete(item.id)} className="win98-button px-1 py-0 text-[9px]"><Trash2 className="h-2.5 w-2.5" /></button>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="px-2 py-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">No items yet.</div>
      )}
    </div>
  );
}

function ContentEditor({ item, nameLabel, hasState, hasSummary, onSave, onCancel }: {
  item: ContentItem; nameLabel: string; hasState?: boolean; hasSummary?: boolean; onSave: (item: ContentItem) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...item, tagsText: item.tags?.join(", ") || "" });
  const isNew = !item.id;

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold">{isNew ? "Create New" : "Edit"} Item</span>
        <button onClick={onCancel} className="win98-titlebar-btn">✕</button>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">{nameLabel}:</label>
            <input value={hasState ? (form.state || "") : (form.name || "")}
              onChange={(e) => hasState ? setForm(f => ({ ...f, state: e.target.value })) : setForm(f => ({ ...f, name: e.target.value }))}
              className="win98-input w-full" placeholder={nameLabel} />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Slug:</label>
            <input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} className="win98-input w-full" placeholder="url-slug" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold mb-1">Tags (comma-separated):</label>
          <input value={form.tagsText} onChange={(e) => setForm(f => ({ ...f, tagsText: e.target.value }))} className="win98-input w-full" placeholder="Republican, Healthcare, Economy" />
        </div>
        {hasSummary && (
          <div>
            <label className="block text-[10px] font-bold mb-1">Summary:</label>
            <input value={form.summary || ""} onChange={(e) => setForm(f => ({ ...f, summary: e.target.value }))} className="win98-input w-full" placeholder="Brief summary" />
          </div>
        )}
        <div>
          <label className="block text-[10px] font-bold mb-1">Content (Markdown):</label>
          <textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} rows={16}
            className="win98-input w-full font-[monospace] text-[10px]" placeholder="# Title..." />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => onSave({ ...form, tags: form.tagsText.split(",").map(s => s.trim()).filter(Boolean) })} className="win98-button text-[10px] font-bold">
            <Save className="h-3 w-3 inline mr-1" />{isNew ? "Create" : "Save"}
          </button>
          <button onClick={onCancel} className="win98-button text-[10px]">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============== LocalFeedsTab ==============
// Embeds the Local Feeds admin pages as sub-tabs. The per-state Sources page
// requires a URL param (`:abbr`), so we navigate to that route instead of
// trying to embed it inline.
function LocalFeedsTab() {
  const [sub, setSub] = useState<"validation" | "audit">("validation");
  const subTabs = [
    { id: "validation" as const, label: "Coverage Validation", emoji: "✅" },
    { id: "audit" as const, label: "Source Audit", emoji: "🔍" },
  ];
  return (
    <div>
      <div className="flex gap-0 mb-2">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`win98-button text-[10px] flex items-center gap-1 ${sub === t.id ? "font-bold bg-white" : ""}`}
            style={sub === t.id ? { borderBottomColor: "white", marginBottom: "-1px", position: "relative", zIndex: 1 } : {}}
          >
            <span>{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>
      <div className="win98-sunken bg-white">
        {sub === "validation" && <LocalFeedsValidation />}
        {sub === "audit" && <LocalFeedsAudit />}
      </div>
    </div>
  );
}
