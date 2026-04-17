import { useState, useEffect, useCallback } from "react";
import { Win98Window } from "@/components/Win98Window";
import { supabase } from "@/integrations/supabase/client";
import {
  setUserRole,
  updateUser,
  resetUserPassword,
  banUser,
  unbanUser,
  deleteUser,
  type AdminUser,
} from "@/lib/adminApi";
import {
  useSectionPermissionsAdmin,
  APP_SECTIONS,
} from "@/hooks/useSectionAccess";
import { toast } from "sonner";
import { Save, Trash2, Plus, Ban, ShieldCheck, KeyRound, Lock, Unlock } from "lucide-react";
import { UserLocationSection } from "@/components/UserLocationSection";

type UserTab = "info" | "password" | "roles" | "permissions" | "location";

const AVAILABLE_ROLES = ["admin", "moderator", "premium", "user"];
const SUSPEND_DURATIONS = [
  { label: "1 Hour", value: "1h" },
  { label: "24 Hours", value: "24h" },
  { label: "7 Days", value: "168h" },
  { label: "30 Days", value: "720h" },
  { label: "90 Days", value: "2160h" },
  { label: "Indefinite", value: "876000h" },
];

interface AdminUserWindowProps {
  user: AdminUser;
  onClose: () => void;
  onUserUpdated: () => void;
  windowIndex?: number;
}

export function AdminUserWindow({ user, onClose, onUserUpdated, windowIndex = 0 }: AdminUserWindowProps) {
  const [activeTab, setActiveTab] = useState<UserTab>("info");
  const [currentUser, setCurrentUser] = useState<AdminUser>(user);

  useEffect(() => setCurrentUser(user), [user]);

  const tabs: Array<{ id: UserTab; label: string; emoji: string }> = [
    { id: "info", label: "General", emoji: "👤" },
    { id: "password", label: "Password", emoji: "🔑" },
    { id: "roles", label: "Roles & Groups", emoji: "🛡️" },
    { id: "permissions", label: "Permissions", emoji: "🔒" },
    { id: "location", label: "Location", emoji: "📍" },
  ];

  const isBanned = currentUser.banned_until && new Date(currentUser.banned_until) > new Date();

  return (
    <Win98Window
      title={`User — ${currentUser.display_name || currentUser.email}`}
      icon={<span className="text-[11px]">👤</span>}
      onClose={onClose}
      defaultPosition={{ x: 80 + windowIndex * 30, y: 60 + windowIndex * 30 }}
      defaultSize={{ width: 480, height: 420 }}
      minSize={{ width: 380, height: 300 }}
      statusBar={
        <span className="text-[9px]">
          {isBanned ? "🚫 Suspended" : "✓ Active"} · Joined {new Date(currentUser.created_at).toLocaleDateString()}
        </span>
      }
    >
      <div className="p-2 h-full flex flex-col">
        {/* Tab bar */}
        <div className="flex gap-0 mb-2 shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`win98-button text-[9px] flex items-center gap-0.5 ${activeTab === t.id ? "font-bold bg-white" : ""}`}
              style={activeTab === t.id ? { borderBottomColor: "white", marginBottom: "-1px", position: "relative", zIndex: 1 } : {}}
            >
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>

        <div className="win98-sunken bg-white p-2 flex-1 overflow-auto">
          {activeTab === "info" && (
            <UserInfoSection user={currentUser} onUpdated={onUserUpdated} />
          )}
          {activeTab === "password" && (
            <PasswordSection user={currentUser} />
          )}
          {activeTab === "roles" && (
            <RolesGroupsSection user={currentUser} onUpdated={onUserUpdated} />
          )}
          {activeTab === "permissions" && (
            <UserPermissionsSection user={currentUser} />
          )}
          {activeTab === "location" && (
            <UserLocationSection userId={currentUser.id} />
          )}
        </div>
      </div>
    </Win98Window>
  );
}

// ========== General Info ==========
function UserInfoSection({ user, onUpdated }: { user: AdminUser; onUpdated: () => void }) {
  const [email, setEmail] = useState(user.email || "");
  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [saving, setSaving] = useState(false);
  const [suspendDuration, setSuspendDuration] = useState("24h");
  const [showSuspend, setShowSuspend] = useState(false);

  useEffect(() => {
    setEmail(user.email || "");
    setDisplayName(user.display_name || "");
  }, [user]);

  const isBanned = user.banned_until && new Date(user.banned_until) > new Date();

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: { email?: string; display_name?: string } = {};
      if (email !== user.email) updates.email = email;
      if (displayName !== (user.display_name || "")) updates.display_name = displayName;
      if (Object.keys(updates).length === 0) { toast.info("No changes"); setSaving(false); return; }
      await updateUser(user.id, updates);
      toast.success("User updated");
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete user ${user.email}? This cannot be undone.`)) return;
    try {
      await deleteUser(user.id);
      toast.success("User deleted");
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSuspend = async () => {
    try {
      await banUser(user.id, suspendDuration);
      const label = SUSPEND_DURATIONS.find(d => d.value === suspendDuration)?.label || suspendDuration;
      toast.success(`Suspended for ${label}`);
      setShowSuspend(false);
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUnsuspend = async () => {
    try {
      await unbanUser(user.id);
      toast.success("Access restored");
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] font-bold mb-1">Email:</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="win98-input w-full" maxLength={255} />
      </div>
      <div>
        <label className="block text-[10px] font-bold mb-1">Display Name:</label>
        <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="win98-input w-full" maxLength={100} />
      </div>

      <div className="win98-sunken bg-[hsl(var(--win98-light))] p-2 text-[9px] space-y-1">
        <div><b>User ID:</b> <span className="font-[monospace]">{user.id}</span></div>
        <div><b>Created:</b> {new Date(user.created_at).toLocaleString()}</div>
        <div><b>Last Sign In:</b> {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never"}</div>
        <div><b>Status:</b> {isBanned ? `🚫 Suspended until ${new Date(user.banned_until!).toLocaleString()}` : "✓ Active"}</div>
      </div>

      <div className="flex gap-1 flex-wrap">
        <button onClick={handleSave} disabled={saving} className="win98-button text-[10px] font-bold disabled:opacity-50">
          <Save className="h-3 w-3 inline mr-0.5" />{saving ? "Saving..." : "Save Changes"}
        </button>
        {isBanned ? (
          <button onClick={handleUnsuspend} className="win98-button text-[10px]" style={{ color: "hsl(140, 60%, 30%)" }}>
            <ShieldCheck className="h-3 w-3 inline mr-0.5" />Restore Access
          </button>
        ) : (
          <button onClick={() => setShowSuspend(!showSuspend)} className="win98-button text-[10px]" style={{ color: "hsl(0, 70%, 45%)" }}>
            <Ban className="h-3 w-3 inline mr-0.5" />Suspend
          </button>
        )}
        <button onClick={handleDelete} className="win98-button text-[10px]" style={{ color: "hsl(0, 70%, 45%)" }}>
          <Trash2 className="h-3 w-3 inline mr-0.5" />Delete User
        </button>
      </div>

      {showSuspend && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2">
          <p className="text-[10px] font-bold mb-1">Suspend Duration:</p>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {SUSPEND_DURATIONS.map(d => (
              <button
                key={d.value}
                onClick={() => setSuspendDuration(d.value)}
                className={`win98-button text-[9px] px-1 py-1 ${suspendDuration === d.value ? "font-bold" : ""}`}
                style={suspendDuration === d.value ? { backgroundColor: "hsl(0, 70%, 92%)", borderStyle: "inset" } : {}}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button onClick={handleSuspend} className="win98-button text-[10px] font-bold" style={{ color: "hsl(0, 70%, 45%)" }}>
            🚫 Confirm Suspend
          </button>
        </div>
      )}
    </div>
  );
}

// ========== Password ==========
function PasswordSection({ user }: { user: AdminUser }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    if (!password.trim()) { toast.error("Password is required"); return; }
    if (password.length < 6) { toast.error("Min 6 characters"); return; }
    if (password !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setSaving(true);
    try {
      await resetUserPassword(user.id, password);
      toast.success(`Password reset for ${user.email}`);
      setPassword("");
      setConfirmPassword("");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        Reset password for <b>{user.email}</b>
      </p>
      <div>
        <label className="block text-[10px] font-bold mb-1">New Password:</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="win98-input w-full" placeholder="Min 6 characters" maxLength={128} />
      </div>
      <div>
        <label className="block text-[10px] font-bold mb-1">Confirm Password:</label>
        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="win98-input w-full" placeholder="Re-enter password" maxLength={128} onKeyDown={e => e.key === "Enter" && handleReset()} />
      </div>
      <button onClick={handleReset} disabled={saving} className="win98-button text-[10px] font-bold disabled:opacity-50">
        <KeyRound className="h-3 w-3 inline mr-0.5" />{saving ? "Resetting..." : "Reset Password"}
      </button>
    </div>
  );
}

// ========== Roles & Groups ==========
function RolesGroupsSection({ user, onUpdated }: { user: AdminUser; onUpdated: () => void }) {
  const [groups, setGroups] = useState<Array<{ id: string; name: string; color: string; roles: string[] }>>([]);
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [addingGroup, setAddingGroup] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  const loadGroupData = useCallback(async () => {
    setLoadingGroups(true);
    const [{ data: allGroups }, { data: memberships }] = await Promise.all([
      supabase.from("role_groups").select("id, name, color, roles").order("name"),
      supabase.from("role_group_members").select("group_id").eq("user_id", user.id),
    ]);
    setGroups((allGroups || []) as any[]);
    setUserGroupIds((memberships || []).map((m: any) => m.group_id));
    setLoadingGroups(false);
  }, [user.id]);

  useEffect(() => { loadGroupData(); }, [loadGroupData]);

  const handleToggleRole = async (role: string, hasRole: boolean) => {
    try {
      await setUserRole(user.id, role, hasRole);
      toast.success(hasRole ? `Removed ${role}` : `Granted ${role}`);
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddGroup = async () => {
    if (!selectedGroupId) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "add_group_member", group_id: selectedGroupId, user_id: user.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Added to group — roles synced");
      setSelectedGroupId("");
      setAddingGroup(false);
      loadGroupData();
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRemoveGroup = async (groupId: string) => {
    const membership = await supabase.from("role_group_members").select("id").eq("user_id", user.id).eq("group_id", groupId).single();
    if (!membership.data) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "remove_group_member", member_id: membership.data.id, user_id: user.id, group_id: groupId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Removed from group");
      loadGroupData();
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
  };

  const memberGroups = groups.filter(g => userGroupIds.includes(g.id));
  const availableGroups = groups.filter(g => !userGroupIds.includes(g.id));

  return (
    <div className="space-y-3">
      {/* Roles */}
      <div>
        <p className="text-[10px] font-bold mb-1">System Roles:</p>
        <div className="flex gap-1 flex-wrap">
          {AVAILABLE_ROLES.map(role => {
            const has = user.roles.includes(role);
            return (
              <button
                key={role}
                onClick={() => handleToggleRole(role, has)}
                className={`win98-button text-[9px] px-2 py-0.5 ${has ? "font-bold" : "opacity-50"}`}
                style={has ? { backgroundColor: role === "admin" ? "#cce" : role === "premium" ? "#fec" : role === "moderator" ? "#cec" : "#ddd", borderStyle: "inset" } : {}}
              >
                {has ? "✓ " : ""}{role}
              </button>
            );
          })}
        </div>
      </div>

      {/* Groups */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-bold">Role Groups:</p>
          <button onClick={() => setAddingGroup(!addingGroup)} className="win98-button text-[9px] px-1 py-0">
            {addingGroup ? "Cancel" : <><Plus className="h-2.5 w-2.5 inline" /> Add</>}
          </button>
        </div>

        {addingGroup && (
          <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 mb-2">
            <div className="flex gap-1">
              <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} className="win98-input flex-1 text-[10px]">
                <option value="">Select group...</option>
                {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button onClick={handleAddGroup} className="win98-button text-[9px] font-bold">Add</button>
            </div>
          </div>
        )}

        {loadingGroups ? (
          <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Loading...</div>
        ) : memberGroups.length === 0 ? (
          <div className="text-[9px] text-[hsl(var(--muted-foreground))] italic">Not in any groups</div>
        ) : (
          <div className="space-y-0.5">
            {memberGroups.map(g => (
              <div key={g.id} className="flex items-center gap-1 win98-sunken px-1.5 py-0.5 bg-white text-[10px]">
                <div className="w-2.5 h-2.5 rounded-sm border border-[hsl(var(--win98-shadow))]" style={{ backgroundColor: g.color }} />
                <span className="font-bold flex-1">{g.name}</span>
                <span className="text-[8px] text-[hsl(var(--muted-foreground))]">{g.roles.join(", ")}</span>
                <button onClick={() => handleRemoveGroup(g.id)} className="win98-button px-0.5 py-0 text-[9px]" title="Remove">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== Permissions ==========
function UserPermissionsSection({ user }: { user: AdminUser }) {
  const { permissions, addPermission, removePermission, updatePermission } = useSectionPermissionsAdmin();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSectionId, setAddSectionId] = useState("");
  const [addSubsectionId, setAddSubsectionId] = useState("__none__");
  const [addAllowed, setAddAllowed] = useState(true);

  // Filter permissions for this user
  const userPerms = permissions.filter(p => p.entity_type === "user" && p.entity_id === user.id);

  const handleAdd = async () => {
    if (!addSectionId) { toast.error("Select a section"); return; }
    try {
      await addPermission({
        section_id: addSectionId,
        subsection_id: addSubsectionId === "__none__" ? null : addSubsectionId,
        entity_type: "user",
        entity_id: user.id,
        allowed: addAllowed,
      });
      toast.success("Permission added");
      setShowAddForm(false);
      setAddSectionId("");
      setAddSubsectionId("__none__");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this permission rule?")) return;
    try {
      await removePermission(id);
      toast.success("Permission removed");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await updatePermission(id, !current);
      toast.success(`Changed to ${!current ? "Allow" : "Deny"}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold">Section Permissions for {user.display_name || user.email}:</p>
        <button onClick={() => setShowAddForm(!showAddForm)} className="win98-button text-[9px] px-1 py-0">
          {showAddForm ? "Cancel" : <><Plus className="h-2.5 w-2.5 inline" /> Add</>}
        </button>
      </div>

      {showAddForm && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 space-y-2">
          <div>
            <label className="block text-[9px] font-bold mb-0.5">Section:</label>
            <select value={addSectionId} onChange={e => { setAddSectionId(e.target.value); setAddSubsectionId("__none__"); }} className="win98-input w-full text-[10px]">
              <option value="">— Select —</option>
              {Object.entries(APP_SECTIONS).map(([id, s]) => (
                <option key={id} value={id}>{s.emoji} {s.label}</option>
              ))}
            </select>
          </div>
          {addSectionId && APP_SECTIONS[addSectionId]?.subsections && (
            <div>
              <label className="block text-[9px] font-bold mb-0.5">Subsection:</label>
              <select value={addSubsectionId} onChange={e => setAddSubsectionId(e.target.value)} className="win98-input w-full text-[10px]">
                <option value="__none__">— Entire Section —</option>
                {Object.entries(APP_SECTIONS[addSectionId].subsections!).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-1">
            <button onClick={() => setAddAllowed(true)} className={`win98-button text-[9px] px-2 ${addAllowed ? "font-bold" : ""}`} style={addAllowed ? { backgroundColor: "hsl(140, 50%, 85%)" } : {}}>
              ✅ Allow
            </button>
            <button onClick={() => setAddAllowed(false)} className={`win98-button text-[9px] px-2 ${!addAllowed ? "font-bold" : ""}`} style={!addAllowed ? { backgroundColor: "hsl(0, 50%, 88%)" } : {}}>
              🚫 Deny
            </button>
            <button onClick={handleAdd} className="win98-button text-[9px] font-bold px-2 ml-auto">Add</button>
          </div>
        </div>
      )}

      {userPerms.length === 0 ? (
        <div className="text-[9px] text-[hsl(var(--muted-foreground))] italic py-2">
          No user-specific permissions. Access determined by role and group rules.
        </div>
      ) : (
        <div className="space-y-0.5">
          {userPerms.map(p => {
            const section = APP_SECTIONS[p.section_id];
            const subLabel = p.subsection_id && section?.subsections ? section.subsections[p.subsection_id] : null;
            return (
              <div key={p.id} className="flex items-center gap-1 win98-sunken px-1.5 py-0.5 bg-white text-[10px]">
                <span>{section?.emoji || "📄"}</span>
                <span className="font-bold">{section?.label || p.section_id}</span>
                {subLabel && <span className="text-[9px] text-[hsl(var(--muted-foreground))]">→ {subLabel}</span>}
                <span className="flex-1" />
                <button
                  onClick={() => handleToggle(p.id, p.allowed)}
                  className="win98-button text-[8px] px-1 py-0 font-bold"
                  style={{ backgroundColor: p.allowed ? "hsl(140, 50%, 85%)" : "hsl(0, 50%, 88%)" }}
                >
                  {p.allowed ? "✅ Allow" : "🚫 Deny"}
                </button>
                <button onClick={() => handleRemove(p.id)} className="win98-button px-0.5 py-0 text-[9px]">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-2">
        <b>Priority:</b> User-specific rules override group and role rules.
      </div>
    </div>
  );
}
