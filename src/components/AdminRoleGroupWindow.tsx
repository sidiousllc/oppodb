import { useState, useEffect, useCallback } from "react";
import { Win98Window } from "@/components/Win98Window";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Trash2, Plus, X, Users } from "lucide-react";

const AVAILABLE_ROLES = ["admin", "moderator", "premium", "user"];
const PRESET_COLORS = ["#c0c0c0", "#cce", "#cec", "#fec", "#fcc", "#ccf", "#ecc", "#cff"];

interface RoleGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  roles: string[];
}

interface GroupMember {
  id: string;
  user_id: string;
  display_name?: string | null;
  email?: string;
}

interface AdminRoleGroupWindowProps {
  group: RoleGroup;
  onClose: () => void;
  onGroupUpdated: () => void;
  windowIndex?: number;
}

export function AdminRoleGroupWindow({ group, onClose, onGroupUpdated, windowIndex = 0 }: AdminRoleGroupWindowProps) {
  const [tab, setTab] = useState<"settings" | "members">("settings");
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [color, setColor] = useState(group.color);
  const [roles, setRoles] = useState<string[]>(group.roles);
  const [saving, setSaving] = useState(false);

  // Members
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; email: string; display_name: string | null }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [addingUser, setAddingUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    const { data: memberData } = await supabase.from("role_group_members").select("*").eq("group_id", group.id);
    const memberList = (memberData || []) as GroupMember[];
    if (memberList.length > 0) {
      const userIds = memberList.map(m => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      for (const m of memberList) {
        const p = profiles?.find(pr => pr.id === m.user_id);
        m.display_name = p?.display_name || null;
      }
    }
    setMembers(memberList);
    setLoadingMembers(false);
  }, [group.id]);

  const loadAllUsers = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("admin-users", { body: { action: "list_users" } });
      setAllUsers((data?.users || []).map((u: any) => ({ id: u.id, email: u.email, display_name: u.display_name })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMembers(); loadAllUsers(); }, [loadMembers, loadAllUsers]);

  const toggleRole = (role: string) => {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    const record = { name: name.trim(), description: description.trim(), color, roles, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("role_groups").update(record).eq("id", group.id);
    if (error) { toast.error(error.message); setSaving(false); return; }

    const rolesChanged = JSON.stringify([...roles].sort()) !== JSON.stringify([...group.roles].sort());
    if (rolesChanged) {
      try {
        const { data, error: syncErr } = await supabase.functions.invoke("admin-users", {
          body: { action: "sync_group_roles", group_id: group.id },
        });
        if (syncErr) throw syncErr;
        if (data?.error) throw new Error(data.error);
        toast.success(`Saved — synced roles for ${data?.synced || 0} members`);
      } catch (err: any) {
        toast.warning(`Saved but role sync failed: ${err.message}`);
      }
    } else {
      toast.success("Group saved");
    }
    setSaving(false);
    onGroupUpdated();
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "add_group_member", group_id: group.id, user_id: selectedUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Member added");
      setSelectedUserId("");
      setAddingUser(false);
      loadMembers();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (!confirm("Remove member?")) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "remove_group_member", member_id: memberId, user_id: userId, group_id: group.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Member removed");
      loadMembers();
    } catch (e: any) { toast.error(e.message); }
  };

  const nonMembers = allUsers.filter(u => !members.some(m => m.user_id === u.id));

  return (
    <Win98Window
      title={`Role Group — ${group.name}`}
      icon={<span className="text-[11px]">🛡️</span>}
      onClose={onClose}
      defaultPosition={{ x: 120 + windowIndex * 30, y: 80 + windowIndex * 30 }}
      defaultSize={{ width: 420, height: 380 }}
      minSize={{ width: 340, height: 260 }}
      statusBar={<span className="text-[9px]">{members.length} members · {roles.length} roles</span>}
    >
      <div className="p-2 h-full flex flex-col">
        <div className="flex gap-0 mb-2 shrink-0">
          <button onClick={() => setTab("settings")} className={`win98-button text-[9px] ${tab === "settings" ? "font-bold bg-white" : ""}`} style={tab === "settings" ? { borderBottomColor: "white", marginBottom: "-1px", position: "relative", zIndex: 1 } : {}}>
            ⚙️ Settings
          </button>
          <button onClick={() => setTab("members")} className={`win98-button text-[9px] ${tab === "members" ? "font-bold bg-white" : ""}`} style={tab === "members" ? { borderBottomColor: "white", marginBottom: "-1px", position: "relative", zIndex: 1 } : {}}>
            <Users className="h-3 w-3 inline mr-0.5" />Members ({members.length})
          </button>
        </div>

        <div className="win98-sunken bg-white p-2 flex-1 overflow-auto">
          {tab === "settings" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold mb-1">Name:</label>
                <input value={name} onChange={e => setName(e.target.value)} className="win98-input w-full" maxLength={50} />
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1">Description:</label>
                <input value={description} onChange={e => setDescription(e.target.value)} className="win98-input w-full" maxLength={200} />
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
              </div>
              <button onClick={handleSave} disabled={saving} className="win98-button text-[10px] font-bold disabled:opacity-50">
                <Save className="h-3 w-3 inline mr-0.5" />{saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {tab === "members" && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{members.length} members</span>
                <button onClick={() => setAddingUser(!addingUser)} className="win98-button text-[9px]">
                  {addingUser ? "Cancel" : <><Plus className="h-2.5 w-2.5 inline" /> Add</>}
                </button>
              </div>
              {addingUser && (
                <div className="win98-raised bg-[hsl(var(--win98-face))] p-2">
                  <div className="flex gap-1">
                    <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="win98-input flex-1 text-[10px]">
                      <option value="">Select user...</option>
                      {nonMembers.map(u => <option key={u.id} value={u.id}>{u.email}{u.display_name ? ` (${u.display_name})` : ""}</option>)}
                    </select>
                    <button onClick={handleAddMember} className="win98-button text-[9px] font-bold">Add</button>
                  </div>
                </div>
              )}
              {loadingMembers ? (
                <div className="text-center py-4 text-[10px]">Loading...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-4 text-[9px] text-[hsl(var(--muted-foreground))]">No members</div>
              ) : (
                <div className="space-y-0.5">
                  {members.map(m => {
                    const u = allUsers.find(u => u.id === m.user_id);
                    return (
                      <div key={m.id} className="flex items-center justify-between win98-sunken px-1.5 py-0.5 bg-white text-[10px]">
                        <div>
                          <span className="font-bold">{u?.email || m.user_id.slice(0, 8)}</span>
                          {(m.display_name || u?.display_name) && (
                            <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-1">({m.display_name || u?.display_name})</span>
                          )}
                        </div>
                        <button onClick={() => handleRemoveMember(m.id, m.user_id)} className="win98-button px-0.5 py-0 text-[9px]">
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Win98Window>
  );
}
