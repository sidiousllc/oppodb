import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { listUsers, setUserRole, deleteUser, type AdminUser } from "@/lib/adminApi";
import { ArrowLeft, Users, FileText, Globe, AlertTriangle, BookOpen, Shield, ShieldCheck, Trash2, Plus, Save, X, Edit3, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

type Tab = "users" | "candidates" | "maga" | "local" | "narratives";

interface ContentItem {
  id: string;
  name?: string;
  state?: string;
  slug: string;
  content: string;
  summary?: string;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isModerator, canManageContent, loading: roleLoading } = useUserRole();
  const [tab, setTab] = useState<Tab>("users");

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin && !isModerator) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <Shield className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">You need admin or moderator privileges to access this page.</p>
        <button onClick={() => navigate("/")} className="text-primary hover:underline text-sm">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }> = [
    { id: "users", label: "Users", icon: Users, adminOnly: true },
    { id: "candidates", label: "Candidates", icon: BookOpen },
    { id: "maga", label: "MAGA Files", icon: AlertTriangle },
    { id: "local", label: "Local Impact", icon: Globe },
    { id: "narratives", label: "Narratives", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h1 className="font-display text-lg font-semibold text-foreground">Admin Panel</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{user?.email}</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {isAdmin ? "Admin" : "Moderator"}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <nav className="flex gap-1 mb-6 border-b border-border">
          {tabs
            .filter(t => !t.adminOnly || isAdmin)
            .map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
        </nav>

        {tab === "users" && isAdmin && <UsersTab />}
        {tab === "candidates" && <CandidatesTab />}
        {tab === "maga" && <ContentTab table="maga_files" nameField="name" />}
        {tab === "local" && <ContentTab table="local_impacts" nameField="state" hasState hasSummary />}
        {tab === "narratives" && <ContentTab table="narrative_reports" nameField="name" />}
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const u = await listUsers();
      setUsers(u);
    } catch (e: any) {
      toast.error("Failed to load users: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleToggleRole = async (userId: string, role: string, hasRole: boolean) => {
    try {
      await setUserRole(userId, role, hasRole);
      toast.success(hasRole ? `Removed ${role} role` : `Granted ${role} role`);
      loadUsers();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      await deleteUser(userId);
      toast.success("User deleted");
      loadUsers();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Sign In</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Roles</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="px-4 py-3 font-medium text-foreground">{u.email}</td>
              <td className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1.5">
                  {["admin", "moderator"].map(role => {
                    const has = u.roles.includes(role);
                    return (
                      <button
                        key={role}
                        onClick={() => handleToggleRole(u.id, role, has)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          has
                            ? role === "admin"
                              ? "bg-primary/15 text-primary"
                              : "bg-accent/15 text-accent"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {has ? "✓ " : ""}{role}
                      </button>
                    );
                  })}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => handleDelete(u.id, u.email || "")} className="text-destructive hover:text-destructive/80 p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidatesTab() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("candidate_profiles")
      .select("id, name, slug, content")
      .eq("is_subpage", false)
      .order("name");
    setItems((data || []) as ContentItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (item: ContentItem) => {
    if (item.id) {
      const { error } = await supabase
        .from("candidate_profiles")
        .update({ name: item.name, slug: item.slug, content: item.content })
        .eq("id", item.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Updated");
    } else {
      const { error } = await supabase
        .from("candidate_profiles")
        .insert({ name: item.name || "", slug: item.slug, content: item.content, github_path: `candidates/${item.slug}.md` });
      if (error) { toast.error(error.message); return; }
      toast.success("Created");
    }
    setEditing(null);
    setCreating(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this candidate profile?")) return;
    const { error } = await supabase.from("candidate_profiles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (editing || creating) {
    return (
      <ContentEditor
        item={editing || { id: "", name: "", slug: "", content: "" }}
        nameLabel="Name"
        onSave={handleSave}
        onCancel={() => { setEditing(null); setCreating(false); }}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{items.length} candidate profiles</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Profile
        </button>
      </div>
      <ContentList items={items} onEdit={setEditing} onDelete={handleDelete} nameField="name" />
    </div>
  );
}

function ContentTab({ table, nameField, hasState, hasSummary }: { table: string; nameField: string; hasState?: boolean; hasSummary?: boolean }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from(table as "maga_files" | "local_impacts" | "narrative_reports")
      .select("*")
      .order(nameField);
    setItems((data || []) as unknown as ContentItem[]);
    setLoading(false);
  }, [table, nameField]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (item: ContentItem) => {
    const record: any = { slug: item.slug, content: item.content };
    if (hasState) {
      record.state = item.state || item.name;
      if (hasSummary) record.summary = item.summary || "";
    } else {
      record.name = item.name;
    }

    if (item.id) {
      const { error } = await supabase.from(table as "maga_files" | "local_impacts" | "narrative_reports").update(record).eq("id", item.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Updated");
    } else {
      const { error } = await supabase.from(table as "maga_files" | "local_impacts" | "narrative_reports").insert(record);
      if (error) { toast.error(error.message); return; }
      toast.success("Created");
    }
    setEditing(null);
    setCreating(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (editing || creating) {
    return (
      <ContentEditor
        item={editing || { id: "", name: "", state: "", slug: "", content: "", summary: "" }}
        nameLabel={hasState ? "State" : "Name"}
        hasState={hasState}
        hasSummary={hasSummary}
        onSave={handleSave}
        onCancel={() => { setEditing(null); setCreating(false); }}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{items.length} items</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>
      <ContentList items={items} onEdit={setEditing} onDelete={handleDelete} nameField={nameField} />
    </div>
  );
}

function ContentList({ items, onEdit, onDelete, nameField }: {
  items: ContentItem[];
  onEdit: (item: ContentItem) => void;
  onDelete: (id: string) => void;
  nameField: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="divide-y divide-border">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">
                {(item as any)[nameField] || item.slug}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                /{item.slug} · {item.content.length} chars
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onEdit(item)} className="p-2 text-muted-foreground hover:text-foreground">
                <Edit3 className="h-4 w-4" />
              </button>
              <button onClick={() => onDelete(item.id)} className="p-2 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="px-4 py-12 text-center text-muted-foreground">No items yet. Click "Add" to create one.</div>
        )}
      </div>
    </div>
  );
}

function ContentEditor({ item, nameLabel, hasState, hasSummary, onSave, onCancel }: {
  item: ContentItem;
  nameLabel: string;
  hasState?: boolean;
  hasSummary?: boolean;
  onSave: (item: ContentItem) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...item });
  const isNew = !item.id;

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {isNew ? "Create New" : "Edit"} Item
        </h2>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{nameLabel}</label>
            <input
              value={hasState ? (form.state || "") : (form.name || "")}
              onChange={(e) => hasState
                ? setForm(f => ({ ...f, state: e.target.value }))
                : setForm(f => ({ ...f, name: e.target.value }))
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder={nameLabel}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Slug</label>
            <input
              value={form.slug}
              onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="url-friendly-slug"
            />
          </div>
        </div>

        {hasSummary && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Summary</label>
            <input
              value={form.summary || ""}
              onChange={(e) => setForm(f => ({ ...f, summary: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Brief summary..."
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Content (Markdown)</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
            rows={20}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono"
            placeholder="# Title\n\nContent here..."
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => onSave(form)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            {isNew ? "Create" : "Save Changes"}
          </button>
          <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
