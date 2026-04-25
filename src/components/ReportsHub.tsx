// Reports list / dashboard. Lets users create new reports and pick one to edit.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ReportBuilder } from "./ReportBuilder";
import { toast } from "sonner";
import { Plus, FileText, Trash2, Users, Calendar, Loader2 } from "lucide-react";
import { OfflineSectionStatus } from "@/components/OfflineSectionStatus";
import { OfflineSectionDownloadButton } from "@/components/OfflineSectionDownloadButton";

interface ReportRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  is_public: boolean;
  updated_at: string;
}

export function ReportsHub() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [shared, setShared] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [own, shr] = await Promise.all([
      supabase.from("reports").select("id, owner_id, title, description, is_public, updated_at")
        .eq("owner_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("reports").select("id, owner_id, title, description, is_public, updated_at")
        .neq("owner_id", user.id).order("updated_at", { ascending: false }),
    ]);
    setReports((own.data ?? []) as ReportRow[]);
    setShared((shr.data ?? []) as ReportRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase.from("reports").insert({
      owner_id: user.id,
      title: "Untitled Report",
      description: "",
      blocks: [],
    }).select("id").maybeSingle();
    setCreating(false);
    if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
    setActiveId((data as any).id);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  if (activeId) {
    return <ReportBuilder reportId={activeId} onBack={() => { setActiveId(null); load(); }} />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-end gap-2 items-center"><OfflineSectionDownloadButtonProxy /><OfflineSectionStatus label="Reports" tables={["reports","report_shares","entity_notes"]} /></div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText size={18} /> Report Builder
          </h2>
          <p className="text-xs text-muted-foreground">
            Build custom drag-and-drop reports from any section in the app.
          </p>
        </div>
        <button
          onClick={create}
          disabled={creating}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          New Report
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading reports…</div>
      ) : (
        <>
          <section>
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">Your reports ({reports.length})</h3>
            {reports.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded p-6 text-center">
                No reports yet. Click <strong>New Report</strong> to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reports.map((r) => (
                  <ReportCard key={r.id} r={r} onOpen={() => setActiveId(r.id)} onDelete={() => remove(r.id)} />
                ))}
              </div>
            )}
          </section>

          {shared.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                <Users size={12} /> Shared with you ({shared.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {shared.map((r) => (
                  <ReportCard key={r.id} r={r} onOpen={() => setActiveId(r.id)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ReportCard({ r, onOpen, onDelete }: { r: ReportRow; onOpen: () => void; onDelete?: () => void }) {
  return (
    <div className="border border-border bg-card rounded p-3 hover:border-primary cursor-pointer transition-colors">
      <div onClick={onOpen}>
        <div className="font-bold text-sm truncate">{r.title}</div>
        {r.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.description}</div>}
        <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <Calendar size={10} />
          {new Date(r.updated_at).toLocaleString()}
          {r.is_public && <span className="ml-2 px-1 bg-accent rounded">public</span>}
        </div>
      </div>
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="mt-2 text-[10px] flex items-center gap-1 text-destructive hover:underline"
        >
          <Trash2 size={10} /> Delete
        </button>
      )}
    </div>
  );
}
