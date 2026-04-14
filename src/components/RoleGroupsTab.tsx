import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit3, Save, X, Users, Shield } from "lucide-react";
import { toast } from "sonner";
import { AdminRoleGroupWindow } from "@/components/AdminRoleGroupWindow";

const AVAILABLE_ROLES = ["admin", "moderator", "premium", "user"];
const PRESET_COLORS = ["#c0c0c0", "#cce", "#cec", "#fec", "#fcc", "#ccf", "#ecc", "#cff"];

interface RoleGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  roles: string[];
  created_at: string;
  updated_at: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
  email?: string;
  display_name?: string;
}

export function RoleGroupsTab() {
  const [groups, setGroups] = useState<RoleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoleGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewingMembers, setViewingMembers] = useState<RoleGroup | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("role_groups")
      .select("*")
      .order("name");
    if (error) { toast.error(error.message); }
    setGroups((data || []) as RoleGroup[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete role group "${name}"? Members will be removed.`)) return;
    const { error } = await supabase.from("role_groups").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Deleted "${name}"`);
    loadGroups();
  };

  if (loading) return <div className="text-center py-8 text-[10px]">Loading role groups...</div>;

  if (editing || creating) {
    return (
      <RoleGroupEditor
        group={editing || { id: "", name: "", description: "", color: "#c0c0c0", roles: [], created_at: "", updated_at: "" }}
        isNew={creating}
        onSave={() => { setEditing(null); setCreating(false); loadGroups(); }}
        onCancel={() => { setEditing(null); setCreating(false); }}
      />
    );
  }

  if (viewingMembers) {
    return (
      <GroupMembersPanel
        group={viewingMembers}
        onBack={() => setViewingMembers(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{groups.length} role groups</span>
        <button onClick={() => setCreating(true)} className="win98-button text-[10px] flex items-center gap-1 font-bold">
          <Plus className="h-3 w-3" /> Create Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="win98-sunken bg-white p-8 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
          <Shield className="h-6 w-6 mx-auto mb-2 opacity-40" />
          No role groups yet. Create one to organize user permissions.
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(g => (
            <div key={g.id} className="win98-raised bg-[hsl(var(--win98-face))] p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-sm border border-[hsl(var(--win98-shadow))]" style={{ backgroundColor: g.color }} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold truncate">{g.name}</div>
                    {g.description && <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">{g.description}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex gap-0.5 mr-2">
                    {g.roles.map(r => (
                      <span key={r} className="text-[8px] font-bold px-1 py-0 win98-raised" style={{ backgroundColor: g.color }}>
                        {r}
                      </span>
                    ))}
                    {g.roles.length === 0 && <span className="text-[8px] text-[hsl(var(--muted-foreground))] italic">no roles</span>}
                  </div>
                  <button onClick={() => setViewingMembers(g)} className="win98-button px-1 py-0 text-[9px]" title="Members">
                    <Users className="h-2.5 w-2.5" />
                  </button>
                  <button onClick={() => setEditing(g)} className="win98-button px-1 py-0 text-[9px]" title="Edit">
                    <Edit3 className="h-2.5 w-2.5" />
                  </button>
                  <button onClick={() => handleDelete(g.id, g.name)} className="win98-button px-1 py-0 text-[9px]" title="Delete">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleGroupEditor({ group, isNew, onSave, onCancel }: {
  group: RoleGroup; isNew: boolean; onSave: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [color, setColor] = useState(group.color);
  const [roles, setRoles] = useState<string[]>(group.roles);
  const [saving, setSaving] = useState(false);

  const toggleRole = (role: string) => {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const record = { name: name.trim(), description: description.trim(), color, roles, updated_at: new Date().toISOString() };

    if (isNew) {
      const { error } = await supabase.from("role_groups").insert(record);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(`Created "${name}"`);
    } else {
      const { error } = await supabase.from("role_groups").update(record).eq("id", group.id);
      if (error) { toast.error(error.message); setSaving(false); return; }

      // Sync roles to all existing members when roles change
      const rolesChanged = JSON.stringify([...roles].sort()) !== JSON.stringify([...group.roles].sort());
      if (rolesChanged) {
        try {
          const { data, error: syncErr } = await supabase.functions.invoke("admin-users", {
            body: { action: "sync_group_roles", group_id: group.id },
          });
          if (syncErr) throw syncErr;
          if (data?.error) throw new Error(data.error);
          const synced = data?.synced || 0;
          toast.success(`Updated "${name}" — synced roles for ${synced} member${synced !== 1 ? "s" : ""}`);
        } catch (err: any) {
          toast.warning(`Group saved but role sync failed: ${err.message}`);
        }
      } else {
        toast.success(`Updated "${name}"`);
      }
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold">{isNew ? "Create" : "Edit"} Role Group</span>
        <button onClick={onCancel} className="win98-titlebar-btn">✕</button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">Name:</label>
            <input value={name} onChange={e => setName(e.target.value)} className="win98-input w-full" placeholder="e.g. Research Team" maxLength={50} />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Color:</label>
            <div className="flex gap-1">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-sm border ${color === c ? "border-[hsl(var(--win98-dark))] border-2" : "border-[hsl(var(--win98-shadow))]"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold mb-1">Description:</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="win98-input w-full" placeholder="What this group is for..." maxLength={200} />
        </div>

        <div>
          <label className="block text-[10px] font-bold mb-1">Assigned Roles:</label>
          <div className="flex gap-1">
            {AVAILABLE_ROLES.map(role => (
              <button key={role} onClick={() => toggleRole(role)}
                className={`win98-button text-[10px] px-2 py-0.5 ${roles.includes(role) ? "font-bold" : "opacity-50"}`}
                style={roles.includes(role) ? { backgroundColor: color, borderStyle: "inset" } : {}}
              >
                {roles.includes(role) ? "✓ " : ""}{role}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">
            Members added to this group will receive these roles automatically.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="win98-button text-[10px] font-bold disabled:opacity-50">
            <Save className="h-3 w-3 inline mr-1" />{saving ? "Saving..." : isNew ? "Create" : "Save"}
          </button>
          <button onClick={onCancel} className="win98-button text-[10px]">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function GroupMembersPanel({ group, onBack }: { group: RoleGroup; onBack: () => void }) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; email: string; display_name: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [addingUser, setAddingUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const { data: memberData } = await supabase
      .from("role_group_members")
      .select("*")
      .eq("group_id", group.id);

    // Fetch profiles for display names
    const memberList = (memberData || []) as GroupMember[];
    if (memberList.length > 0) {
      const userIds = memberList.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      for (const m of memberList) {
        const p = profiles?.find(pr => pr.id === m.user_id);
        m.display_name = p?.display_name || null;
      }
    }
    setMembers(memberList);
    setLoading(false);
  }, [group.id]);

  const loadAllUsers = useCallback(async () => {
    // Use admin-users edge function to get user list
    try {
      const { data } = await supabase.functions.invoke("admin-users", {
        body: { action: "list_users" },
      });
      setAllUsers((data?.users || []).map((u: any) => ({ id: u.id, email: u.email, display_name: u.display_name })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMembers(); loadAllUsers(); }, [loadMembers, loadAllUsers]);

  const handleAddMember = async () => {
    if (!selectedUserId) { toast.error("Select a user"); return; }
    
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "add_group_member", group_id: group.id, user_id: selectedUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Member added — roles synced automatically");
      setSelectedUserId("");
      setAddingUser(false);
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to add member");
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (!confirm("Remove this member from the group? Their roles from this group will be revoked (unless granted by another group).")) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "remove_group_member", member_id: memberId, user_id: userId, group_id: group.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const revoked = data?.revoked_roles?.length ? ` (revoked: ${data.revoked_roles.join(", ")})` : "";
      toast.success(`Member removed${revoked}`);
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  };

  const nonMembers = allUsers.filter(u => !members.some(m => m.user_id === u.id));

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack} className="win98-button text-[10px]">← Back</button>
        <div className="w-3 h-3 rounded-sm border border-[hsl(var(--win98-shadow))]" style={{ backgroundColor: group.color }} />
        <span className="text-[11px] font-bold">{group.name}</span>
        <span className="text-[9px] text-[hsl(var(--muted-foreground))]">— {members.length} members</span>
      </div>

      {group.roles.length > 0 && (
        <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1 mb-3 text-[9px]">
          <b>Roles:</b> {group.roles.join(", ")}
        </div>
      )}

      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{members.length} members</span>
        <button onClick={() => setAddingUser(!addingUser)} className="win98-button text-[10px] flex items-center gap-1">
          {addingUser ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {addingUser ? "Cancel" : "Add Member"}
        </button>
      </div>

      {addingUser && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 mb-2">
          <div className="flex gap-1">
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="win98-input flex-1 text-[10px]">
              <option value="">Select user...</option>
              {nonMembers.map(u => (
                <option key={u.id} value={u.id}>{u.email}{u.display_name ? ` (${u.display_name})` : ""}</option>
              ))}
            </select>
            <button onClick={handleAddMember} className="win98-button text-[10px] font-bold">Add</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-[10px]">Loading members...</div>
      ) : (
        <div className="win98-sunken bg-white">
          {members.map(m => {
            const user = allUsers.find(u => u.id === m.user_id);
            return (
              <div key={m.id} className="flex items-center justify-between px-2 py-1.5 border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] text-[10px]">
                <div>
                  <span className="font-bold">{user?.email || m.user_id.slice(0, 8)}</span>
                  {(m.display_name || user?.display_name) && (
                    <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-1">({m.display_name || user?.display_name})</span>
                  )}
                </div>
                <button onClick={() => handleRemoveMember(m.id, m.user_id)} className="win98-button px-1 py-0 text-[9px]" title="Remove">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
          {members.length === 0 && (
            <div className="px-2 py-6 text-center text-[10px] text-[hsl(var(--muted-foreground))]">No members yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
