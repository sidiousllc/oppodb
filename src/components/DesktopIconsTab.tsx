import { useState, useEffect } from "react";
import { Monitor, User, Users, Shield, Lock, Unlock, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const DESKTOP_ICONS: Array<{ id: string; label: string; emoji: string; description: string; category: string }> = [
  { id: "dashboard",        label: "Opposition Research DB", emoji: "🌐", description: "Main dashboard / desktop",               category: "system"   },
  { id: "my-computer",     label: "My Computer",           emoji: "🖥️", description: "System info / storage browser",        category: "system"   },
  { id: "my-profile",      label: "My Profile",            emoji: "👤", description: "Profile settings and preferences",         category: "system"   },
  { id: "recycle-bin",     label: "Recycle Bin",            emoji: "🗑️", description: "Deleted items",                         category: "system"   },
  { id: "admin",           label: "Admin Panel",            emoji: "🛡️", description: "Administration controls",               category: "admin"     },
  { id: "api",             label: "API Access",            emoji: "🔑", description: "API key management",                     category: "admin"     },
  { id: "network-neighborhood", label: "Network Neighborhood", emoji: "🌍", description: "Connected services overview",    category: "network"  },
  { id: "notepad",         label: "Notepad",               emoji: "📝", description: "Quick notes",                             category: "tools"     },
  { id: "oppohub",         label: "OppoHub",                emoji: "🎯", description: "Opposition research hub",                 category: "research"  },
  { id: "leghub",          label: "LegHub",                 emoji: "⚖️", description: "Legislative tracking hub",                category: "research"  },
  { id: "polling",         label: "DataHub",                emoji: "📊", description: "Polling data and charts",              category: "research"  },
  { id: "intelhub",        label: "IntelHub",              emoji: "🕵️", description: "Intelligence briefings",                 category: "research"  },
  { id: "messaging",       label: "MessagingHub",           emoji: "📢", description: "Messaging guidance",                    category: "research"  },
  { id: "research-tools",  label: "Research Tools",        emoji: "🔬", description: "OSINT, court records, reports",        category: "research"  },
  { id: "internationalhub",label: "International Hub",     emoji: "🌐", description: "Global intel and elections",            category: "research"  },
  { id: "live-elections",  label: "Live Elections",        emoji: "🏛️", description: "Real-time election results",           category: "research"  },
  { id: "reports",         label: "ReportHub",             emoji: "📝", description: "Narrative and impact reports",         category: "research"  },
  { id: "warroom",         label: "War Rooms",             emoji: "🎖️", description: "Collaborative war rooms",               category: "collaboration" },
  { id: "crm",             label: "CRM",                   emoji: "👥", description: "Stakeholder management",                  category: "collaboration" },
  { id: "alerts",          label: "Alerts",                 emoji: "🚨", description: "Alert rules and notifications",         category: "collaboration" },
  { id: "forecast",        label: "Forecast",              emoji: "📈", description: "Election forecast lab",                category: "collaboration" },
  { id: "investigations",  label: "Investigations",       emoji: "🔍", description: "Investigation trackers",               category: "collaboration" },
  { id: "graph",           label: "Entity Graph",         emoji: "🕸️", description: "Relationship graph explorer",         category: "collaboration" },
  { id: "documentation",   label: "Documentation",        emoji: "📖", description: "Wiki docs and technical references",   category: "docs"      },
  { id: "ai-history",      label: "AI History",            emoji: "🧠", description: "AI generation history",                 category: "tools"      },
  { id: "task-manager",    label: "Task Manager",          emoji: "📋", description: "Background tasks and processes",      category: "tools"      },
  { id: "deploy-checklist",label: "Deploy Checklist",     emoji: "🚀", description: "Deployment verification",             category: "admin"     },
  { id: "log-off",         label: "Log Off",               emoji: "🔌", description: "Sign out of session",                   category: "system"     },
];

export type DesktopIconPermission = {
  id: string;
  section_id: string;
  entity_type: "user" | "group" | "role";
  entity_id: string;
  allowed: boolean;
  created_at: string;
};

const CATEGORIES = [
  { id: "system",        label: "System",        icon: Monitor   },
  { id: "admin",        label: "Admin",         icon: Shield    },
  { id: "network",      label: "Network",       icon: Monitor   },
  { id: "tools",        label: "Tools",         icon: Monitor  },
  { id: "research",     label: "Research",      icon: Monitor  },
  { id: "collaboration",label: "Collaboration", icon: Users     },
  { id: "docs",         label: "Documentation", icon: Monitor  },
];

export function DesktopIconsTab() {
  const [permissions, setPermissions] = useState<DesktopIconPermission[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; display_name?: string; email?: string }>>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [addEntityType, setAddEntityType] = useState<"user" | "group" | "role">("role");
  const [addEntityId, setAddEntityId] = useState("");
  const [addAllowed, setAddAllowed] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadPermissions = async () => {
    const { data } = await supabase
      .from("section_permissions")
      .select("*")
      .eq("section_id", "desktop-icons")
      .order("created_at", { ascending: false });
    setPermissions((data as any) || []);
  };

  useEffect(() => {
    Promise.all([
      loadPermissions(),
      supabase.from("profiles").select("id, display_name").limit(500).then(({ data }) => setUsers((data as any) || [])),
      supabase.from("role_groups").select("id, name, color").then(({ data }) => setGroups(data || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const addRule = async () => {
    if (!addEntityId) { toast.error("Select an entity"); return; }
    const { error } = await supabase.from("section_permissions").insert({
      section_id: "desktop-icons",
      entity_type: addEntityType,
      entity_id: addEntityId,
      allowed: addAllowed,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Rule added");
    setShowAddModal(false);
    setAddEntityId("");
    loadPermissions();
  };

  const removeRule = async (id: string) => {
    if (!confirm("Remove this rule?")) return;
    await supabase.from("section_permissions").delete().eq("id", id);
    loadPermissions();
  };

  const toggleRule = async (id: string, current: boolean) => {
    await supabase.from("section_permissions").update({ allowed: !current }).eq("id", id);
    loadPermissions();
  };

  const getEntityLabel = (type: string, id: string) => {
    if (type === "user") {
      const u = users.find(u => u.id === id);
      return u?.display_name || u?.email || id.substring(0, 8) + "…";
    }
    if (type === "group") {
      const g = groups.find(g => g.id === id);
      return g?.name || id.substring(0, 8) + "…";
    }
    return id; // role
  };

  if (loading) return <div className="text-center py-8 text-[10px]">Loading…</div>;

  return (
    <div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-3">
        Control which users, groups, or roles can see specific desktop icons.
        Rules apply per-icon — users not matching any rule see the icon by default.
      </p>

      <div className="mb-3 flex justify-end">
        <button onClick={() => setShowAddModal(true)} className="win98-button text-[10px] flex items-center gap-1">
          <Plus className="h-3 w-3" /> Add Rule
        </button>
      </div>

      {/* Icons grouped by category */}
      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const catIcons = DESKTOP_ICONS.filter(i => i.category === cat.id);
          if (!catIcons.length) return null;
          return (
            <div key={cat.id} className="win98-raised">
              <div className="win98-titlebar text-[10px] px-2 py-0.5 flex items-center gap-1">
                <cat.icon className="h-3 w-3" />
                <span className="font-bold">{cat.label}</span>
                <span className="ml-auto text-[9px] opacity-60">{catIcons.length} icons</span>
              </div>
              <div className="bg-white divide-y divide-[hsl(var(--win98-shadow))]">
                {catIcons.map(icon => {
                  const iconPerms = permissions.filter(p => p.entity_id === icon.id);
                  return (
                    <div key={icon.id} className="px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{icon.emoji}</span>
                        <div>
                          <div className="text-[11px] font-bold">{icon.label}</div>
                          <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{icon.description}</div>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          {iconPerms.length > 0 ? (
                            <span className="text-[9px] px-1 py-0 win98-sunken bg-yellow-100 text-yellow-800">
                              <Lock className="h-2 w-2 inline mr-0.5" />{iconPerms.length} rule{iconPerms.length > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
                              <Unlock className="h-2 w-2 inline mr-0.5" />Open
                            </span>
                          )}
                        </div>
                      </div>
                      {iconPerms.length > 0 && (
                        <div className="ml-7 flex flex-wrap gap-1 mt-1">
                          {iconPerms.map(p => (
                            <span key={p.id} className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 win98-sunken ${p.allowed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                              {p.entity_type === "user" ? "👤" : p.entity_type === "group" ? "👥" : "🛡️"}
                              {getEntityLabel(p.entity_type, p.entity_id)}
                              <button onClick={() => toggleRule(p.id, p.allowed)} className="hover:underline ml-1">{p.allowed ? "✅" : "🚫"}</button>
                              <button onClick={() => removeRule(p.id)} className="hover:text-red-600 ml-0.5">✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowAddModal(false)}>
          <div className="win98-raised w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="win98-titlebar flex px-2 py-1">
              <span className="text-[11px] flex-1">Add Desktop Icon Rule</span>
              <button className="win98-titlebar-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-[10px] font-bold mb-1">Icon (ID):</label>
                <select className="win98-input w-full text-[10px]" onChange={e => setAddEntityId(e.target.value)} value={addEntityId}>
                  <option value="">— Select icon —</option>
                  {DESKTOP_ICONS.map(i => (
                    <option key={i.id} value={i.id}>{i.emoji} {i.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1">Apply to:</label>
                <div className="flex gap-1">
                  {(["role", "group", "user"] as const).map(t => (
                    <button key={t} onClick={() => setAddEntityType(t)} className={`win98-button text-[10px] px-2 py-0.5 ${addEntityType === t ? "font-bold" : ""}`}>
                      {t === "user" ? <User className="h-3 w-3" /> : t === "group" ? <Users className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1">{addEntityType === "user" ? "User" : addEntityType === "group" ? "Group" : "Role"}:</label>
                <select className="win98-input w-full text-[10px]" value={addEntityId} onChange={e => setAddEntityId(e.target.value)}>
                  <option value="">— Select —</option>
                  {addEntityType === "user" ? users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.email || u.id}</option>)
                    : addEntityType === "group" ? groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)
                    : ["admin", "moderator", "premium", "user"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1">Access:</label>
                <div className="flex gap-2">
                  <button onClick={() => setAddAllowed(true)} className="win98-button text-[10px] px-3 py-0.5" style={addAllowed ? { backgroundColor: "hsl(140,50%,85%)" } : {}}>
                    ✅ Allow
                  </button>
                  <button onClick={() => setAddAllowed(false)} className="win98-button text-[10px] px-3 py-0.5" style={!addAllowed ? { backgroundColor: "hsl(0,50%,88%)" } : {}}>
                    🚫 Deny
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-1 pt-1">
                <button onClick={() => setShowAddModal(false)} className="win98-button text-[10px]">Cancel</button>
                <button onClick={addRule} className="win98-button text-[10px] font-bold">Add Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
