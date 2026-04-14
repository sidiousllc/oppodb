import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Shield, Users, User, Lock, Unlock, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useSectionPermissionsAdmin,
  APP_SECTIONS,
  type SectionPermission,
} from "@/hooks/useSectionAccess";
import { listUsers, type AdminUser } from "@/lib/adminApi";

export function SectionPermissionsTab() {
  const { permissions, loading, addPermission, removePermission, updatePermission } = useSectionPermissionsAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState<string | null>(null); // section_id being added to
  const [addSubsection, setAddSubsection] = useState<string>("__none__");
  const [addEntityType, setAddEntityType] = useState<"user" | "group" | "role">("role");
  const [addEntityId, setAddEntityId] = useState("");
  const [addAllowed, setAddAllowed] = useState(true);

  useEffect(() => {
    listUsers().then(setUsers).catch(() => {});
    supabase.from("role_groups").select("id, name, color").order("name").then(({ data }) => {
      if (data) setGroups(data);
    });
  }, []);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (!showAddForm || !addEntityId) {
      toast.error("Please select an entity");
      return;
    }
    try {
      await addPermission({
        section_id: showAddForm,
        subsection_id: addSubsection === "__none__" ? null : addSubsection,
        entity_type: addEntityType,
        entity_id: addEntityId,
        allowed: addAllowed,
      });
      toast.success("Permission rule added");
      setShowAddForm(null);
      setAddEntityId("");
      setAddSubsection("__none__");
    } catch (e: any) {
      toast.error(e.message || "Failed to add permission");
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this permission rule?")) return;
    try {
      await removePermission(id);
      toast.success("Permission removed");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleAllowed = async (id: string, current: boolean) => {
    try {
      await updatePermission(id, !current);
      toast.success(`Changed to ${!current ? "Allow" : "Deny"}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getEntityLabel = (type: string, id: string) => {
    if (type === "user") {
      const u = users.find(u => u.id === id);
      return u ? (u.display_name || u.email || id) : id.substring(0, 8) + "...";
    }
    if (type === "group") {
      const g = groups.find(g => g.id === id);
      return g ? g.name : id.substring(0, 8) + "...";
    }
    return id; // role name
  };

  const getEntityColor = (type: string, id: string) => {
    if (type === "group") {
      const g = groups.find(g => g.id === id);
      return g?.color || "#c0c0c0";
    }
    return undefined;
  };

  const entityOptions = () => {
    if (addEntityType === "user") return users.map(u => ({ value: u.id, label: u.display_name || u.email || u.id }));
    if (addEntityType === "group") return groups.map(g => ({ value: g.id, label: g.name }));
    return [
      { value: "admin", label: "Admin" },
      { value: "moderator", label: "Moderator" },
      { value: "premium", label: "Premium" },
      { value: "user", label: "User" },
    ];
  };

  if (loading) return <div className="text-center py-8 text-[10px]">Loading permissions...</div>;

  return (
    <div>
      <div className="mb-3">
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Configure which users, groups, or roles can access each section and subsection.
          If no rules exist for a section, all users have access. Adding "Allow" rules restricts access to only those entities listed.
        </p>
      </div>

      {/* Sections list */}
      <div className="space-y-1">
        {Object.entries(APP_SECTIONS).map(([sectionId, section]) => {
          const sectionPerms = permissions.filter(p => p.section_id === sectionId);
          const isExpanded = expandedSections.has(sectionId);
          const hasRules = sectionPerms.length > 0;

          return (
            <div key={sectionId} className="win98-raised">
              {/* Section header */}
              <button
                onClick={() => toggleSection(sectionId)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] hover:bg-[hsl(var(--win98-light))]"
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span>{section.emoji}</span>
                <span className="font-bold flex-1 text-left">{section.label}</span>
                {hasRules ? (
                  <span className="text-[9px] px-1 py-0 win98-sunken font-bold" style={{ color: "hsl(30, 80%, 40%)", backgroundColor: "hsl(40, 80%, 90%)" }}>
                    <Lock className="h-2.5 w-2.5 inline mr-0.5" />{sectionPerms.length} rule{sectionPerms.length > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
                    <Unlock className="h-2.5 w-2.5 inline mr-0.5" />Open
                  </span>
                )}
              </button>

              {/* Expanded section */}
              {isExpanded && (
                <div className="border-t border-[hsl(var(--win98-shadow))] px-2 py-2 bg-white">
                  {/* Section-level permissions */}
                  <div className="mb-2">
                    <div className="text-[10px] font-bold mb-1 flex items-center justify-between">
                      <span>Section-level rules:</span>
                      <button
                        onClick={() => { setShowAddForm(sectionId); setAddSubsection("__none__"); setAddEntityId(""); }}
                        className="win98-button text-[9px] flex items-center gap-0.5 px-1 py-0"
                      >
                        <Plus className="h-2.5 w-2.5" /> Add Rule
                      </button>
                    </div>
                    <PermissionRulesList
                      perms={sectionPerms.filter(p => !p.subsection_id)}
                      getEntityLabel={getEntityLabel}
                      getEntityColor={getEntityColor}
                      onRemove={handleRemove}
                      onToggle={handleToggleAllowed}
                    />
                  </div>

                  {/* Subsections */}
                  {section.subsections && Object.entries(section.subsections).map(([subId, subLabel]) => {
                    const subPerms = sectionPerms.filter(p => p.subsection_id === subId);
                    return (
                      <div key={subId} className="mb-2 ml-3 border-l-2 border-[hsl(var(--win98-shadow))] pl-2">
                        <div className="text-[10px] font-bold mb-1 flex items-center justify-between">
                          <span>📄 {subLabel}</span>
                          <button
                            onClick={() => { setShowAddForm(sectionId); setAddSubsection(subId); setAddEntityId(""); }}
                            className="win98-button text-[9px] flex items-center gap-0.5 px-1 py-0"
                          >
                            <Plus className="h-2.5 w-2.5" /> Add
                          </button>
                        </div>
                        <PermissionRulesList
                          perms={subPerms}
                          getEntityLabel={getEntityLabel}
                          getEntityColor={getEntityColor}
                          onRemove={handleRemove}
                          onToggle={handleToggleAllowed}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Permission Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowAddForm(null)}>
          <div className="win98-raised bg-[hsl(var(--win98-face))] w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="win98-titlebar">
              <span className="text-[11px] flex-1">Add Permission Rule</span>
              <button className="win98-titlebar-btn" onClick={() => setShowAddForm(null)}>✕</button>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-[10px] font-bold mb-1">Section:</label>
                <div className="win98-sunken px-2 py-1 text-[10px] bg-white">
                  {APP_SECTIONS[showAddForm]?.emoji} {APP_SECTIONS[showAddForm]?.label}
                </div>
              </div>

              {APP_SECTIONS[showAddForm]?.subsections && (
                <div>
                  <label className="block text-[10px] font-bold mb-1">Subsection:</label>
                  <select
                    value={addSubsection}
                    onChange={(e) => setAddSubsection(e.target.value)}
                    className="win98-input w-full text-[10px]"
                  >
                    <option value="__none__">— Entire Section —</option>
                    {Object.entries(APP_SECTIONS[showAddForm].subsections!).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold mb-1">Apply to:</label>
                <div className="flex gap-1">
                  {(["role", "group", "user"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setAddEntityType(t); setAddEntityId(""); }}
                      className={`win98-button text-[10px] flex items-center gap-1 px-2 py-0.5 ${addEntityType === t ? "font-bold" : ""}`}
                      style={addEntityType === t ? { backgroundColor: "#dde" } : {}}
                    >
                      {t === "user" ? <User className="h-3 w-3" /> : t === "group" ? <Users className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1">
                  {addEntityType === "user" ? "User:" : addEntityType === "group" ? "Group:" : "Role:"}
                </label>
                <select
                  value={addEntityId}
                  onChange={(e) => setAddEntityId(e.target.value)}
                  className="win98-input w-full text-[10px]"
                >
                  <option value="">— Select —</option>
                  {entityOptions().map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1">Access:</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddAllowed(true)}
                    className={`win98-button text-[10px] flex items-center gap-1 px-3 py-0.5 ${addAllowed ? "font-bold" : ""}`}
                    style={addAllowed ? { backgroundColor: "hsl(140, 50%, 85%)" } : {}}
                  >
                    ✅ Allow
                  </button>
                  <button
                    onClick={() => setAddAllowed(false)}
                    className={`win98-button text-[10px] flex items-center gap-1 px-3 py-0.5 ${!addAllowed ? "font-bold" : ""}`}
                    style={!addAllowed ? { backgroundColor: "hsl(0, 50%, 88%)" } : {}}
                  >
                    🚫 Deny
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-1 pt-1">
                <button onClick={() => setShowAddForm(null)} className="win98-button text-[10px] px-3">Cancel</button>
                <button onClick={handleAdd} className="win98-button text-[10px] px-3 font-bold">Add Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionRulesList({
  perms,
  getEntityLabel,
  getEntityColor,
  onRemove,
  onToggle,
}: {
  perms: SectionPermission[];
  getEntityLabel: (type: string, id: string) => string;
  getEntityColor: (type: string, id: string) => string | undefined;
  onRemove: (id: string) => void;
  onToggle: (id: string, current: boolean) => void;
}) {
  if (perms.length === 0) {
    return <div className="text-[9px] text-[hsl(var(--muted-foreground))] py-0.5 italic">No rules — all users have access</div>;
  }

  return (
    <div className="space-y-0.5">
      {perms.map(p => (
        <div key={p.id} className="flex items-center gap-1 text-[10px] win98-sunken px-1.5 py-0.5 bg-white">
          <span className="text-[9px]">
            {p.entity_type === "user" ? "👤" : p.entity_type === "group" ? "👥" : "🛡️"}
          </span>
          <span className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">{p.entity_type}:</span>
          <span
            className="font-bold flex-1 truncate"
            style={getEntityColor(p.entity_type, p.entity_id) ? { color: getEntityColor(p.entity_type, p.entity_id) } : {}}
          >
            {getEntityLabel(p.entity_type, p.entity_id)}
          </span>
          <button
            onClick={() => onToggle(p.id, p.allowed)}
            className={`win98-button text-[9px] px-1 py-0 font-bold ${p.allowed ? "" : ""}`}
            style={{ backgroundColor: p.allowed ? "hsl(140, 50%, 85%)" : "hsl(0, 50%, 88%)" }}
          >
            {p.allowed ? "✅ Allow" : "🚫 Deny"}
          </button>
          <button
            onClick={() => onRemove(p.id)}
            className="win98-button px-0.5 py-0 text-[9px]"
            title="Remove rule"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
