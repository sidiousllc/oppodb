import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Trash2, Loader2, Eye, Edit3 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface CandidateEditorProps {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    name: string;
    slug: string;
    content: string;
    github_path: string;
    is_subpage: boolean;
    parent_slug: string | null;
    subpage_title: string | null;
  };
  onBack: () => void;
  onSaved: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CandidateEditor({ mode, initialData, onBack, onSaved }: CandidateEditorProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [githubPath, setGithubPath] = useState(initialData?.github_path ?? "");
  const [isSubpage, setIsSubpage] = useState(initialData?.is_subpage ?? false);
  const [parentSlug, setParentSlug] = useState(initialData?.parent_slug ?? "");
  const [subpageTitle, setSubpageTitle] = useState(initialData?.subpage_title ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preview, setPreview] = useState(false);
  const [autoSlug, setAutoSlug] = useState(mode === "create");

  const handleNameChange = (val: string) => {
    if (val.length > 200) return;
    setName(val);
    if (autoSlug && mode === "create") {
      setSlug(slugify(val));
      if (!githubPath) setGithubPath(`${slugify(val)}.md`);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !slug.trim() || !githubPath.trim()) {
      toast.error("Name, slug, and file path are required");
      return;
    }
    if (content.length > 500000) {
      toast.error("Content too large (max 500k characters)");
      return;
    }

    setSaving(true);
    try {
      if (mode === "edit" && initialData) {
        const { error } = await supabase
          .from("candidate_profiles")
          .update({
            name: name.trim(),
            slug: slug.trim(),
            content,
            github_path: githubPath.trim(),
            is_subpage: isSubpage,
            parent_slug: isSubpage ? parentSlug.trim() || null : null,
            subpage_title: isSubpage ? subpageTitle.trim() || null : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id);

        if (error) throw error;
        toast.success("Candidate profile updated");
      } else {
        const { error } = await supabase
          .from("candidate_profiles")
          .insert({
            name: name.trim(),
            slug: slug.trim(),
            content,
            github_path: githubPath.trim(),
            is_subpage: isSubpage,
            parent_slug: isSubpage ? parentSlug.trim() || null : null,
            subpage_title: isSubpage ? subpageTitle.trim() || null : null,
          });

        if (error) throw error;
        toast.success("Candidate profile created");
      }
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("candidate_profiles")
        .delete()
        .eq("id", initialData.id);

      if (error) throw error;
      toast.success("Candidate profile deleted");
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      toast.error(msg);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          {mode === "edit" && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive font-medium">Are you sure?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !slug.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <h1 className="font-display text-xl font-bold text-foreground mb-4">
          {mode === "create" ? "New Candidate Profile" : "Edit Profile"}
        </h1>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Candidate Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. John Smith"
              className="search-input w-full text-sm"
              maxLength={200}
            />
          </div>

          {/* Slug */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Slug *
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setAutoSlug(false);
              }}
              placeholder="e.g. john-smith"
              className="search-input w-full text-sm font-mono"
              maxLength={200}
            />
          </div>

          {/* GitHub Path */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              File Path *
            </label>
            <input
              type="text"
              value={githubPath}
              onChange={(e) => setGithubPath(e.target.value)}
              placeholder="e.g. john-smith.md"
              className="search-input w-full text-sm font-mono"
              maxLength={300}
            />
          </div>

          {/* Subpage toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isSubpage}
                onChange={(e) => setIsSubpage(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs font-medium text-muted-foreground">This is a subpage</span>
            </label>
          </div>

          {isSubpage && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Parent Slug
                </label>
                <input
                  type="text"
                  value={parentSlug}
                  onChange={(e) => setParentSlug(e.target.value)}
                  placeholder="e.g. john-smith"
                  className="search-input w-full text-sm font-mono"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Subpage Title
                </label>
                <input
                  type="text"
                  value={subpageTitle}
                  onChange={(e) => setSubpageTitle(e.target.value)}
                  placeholder="e.g. Healthcare Record"
                  className="search-input w-full text-sm"
                  maxLength={200}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content editor with preview toggle */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">
            Content (Markdown)
          </span>
          <button
            onClick={() => setPreview((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {preview ? <Edit3 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {preview ? "Edit" : "Preview"}
          </button>
        </div>

        {preview ? (
          <div className="p-6 prose-research min-h-[400px]">
            <ReactMarkdown>{content || "*No content yet*"}</ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your research content in Markdown..."
            className="w-full min-h-[400px] p-4 bg-transparent text-sm text-foreground font-mono leading-relaxed resize-y focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}
