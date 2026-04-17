// Drag-and-drop WYSIWYG Report Builder.
// Block palette on the left, draggable canvas in the middle, properties on the right.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import { ArrowLeft, FileText, Save, Download, Trash2, GripVertical, Plus, Share2, RefreshCw, Loader2, Calendar } from "lucide-react";
import {
  BLOCK_PALETTE, type Report, type ReportBlock, type ReportBlockType,
} from "@/lib/reports/types";
import { fetchSnapshot, refreshAllSnapshots } from "@/lib/reports/snapshots";
import { exportReportPdf, exportReportCsv } from "@/lib/reports/exporters";
import { ChartBlockView, TableBlockView, MapBlockView } from "@/components/reports/BlockViews";
import { ReportSchedules } from "@/components/reports/ReportSchedules";

interface Props {
  reportId: string;
  onBack: () => void;
}

function newBlock(type: ReportBlockType): ReportBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading": return { id, type, text: "Section Heading" };
    case "subheading": return { id, type, text: "Subheading" };
    case "text": return { id, type, text: "" };
    case "image": return { id, type, url: "", caption: "" };
    case "divider": return { id, type };
    case "page_break": return { id, type };
    case "tabs": return { id, type, tabs: [{ id: crypto.randomUUID(), label: "Tab 1", blocks: [] }] };
    case "admin_activity": return { id, type, filters: {} };
    case "admin_locations": return { id, type, filters: {}, showMap: true };
    case "api_data": return { id, type, endpoint: "/v1/candidates" };
    case "mcp_data": return { id, type, toolName: "search_all", args: { query: "" } };
    case "chart": return { id, type, chartType: "bar", data: [{ label: "A", value: 10 }, { label: "B", value: 20 }, { label: "C", value: 15 }], series: ["value"] };
    case "table": return { id, type, columns: ["Column 1", "Column 2"], rows: [["Row 1", "Value"], ["Row 2", "Value"]] };
    case "map": return { id, type, mode: "districts", districts: [] };
    default: return { id, type, refId: "", snapshot: undefined } as ReportBlock;
  }
}

export function ReportBuilder({ reportId, onBack }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shares, setShares] = useState<Array<{ id: string; shared_with_user_id: string; can_edit: boolean; profile?: { display_name: string | null } }>>([]);
  const [showShare, setShowShare] = useState(false);
  const [showSchedules, setShowSchedules] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
    if (error || !data) {
      toast.error("Could not load report");
      setLoading(false);
      return;
    }
    setReport(data as unknown as Report);
    const { data: sh } = await supabase
      .from("report_shares")
      .select("id, shared_with_user_id, can_edit")
      .eq("report_id", reportId);
    setShares((sh ?? []) as any);
    setLoading(false);
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  const isOwner = report?.owner_id === user?.id;

  const updateReport = (patch: Partial<Report>) => {
    if (!report) return;
    setReport({ ...report, ...patch });
  };

  const addBlock = async (type: ReportBlockType) => {
    if (!report) return;
    const b = newBlock(type);
    // Auto-fetch snapshot for data blocks if refId is preset (skip for now since user must fill refId)
    setReport({ ...report, blocks: [...report.blocks, b] });
    setSelectedBlockId(b.id);
  };

  const updateBlock = (id: string, patch: Partial<ReportBlock>) => {
    if (!report) return;
    setReport({
      ...report,
      blocks: report.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as ReportBlock) : b)),
    });
  };

  const removeBlock = (id: string) => {
    if (!report) return;
    setReport({ ...report, blocks: report.blocks.filter((b) => b.id !== id) });
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    if (!report) return;
    const idx = report.blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= report.blocks.length) return;
    const next = [...report.blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    setReport({ ...report, blocks: next });
  };

  const refreshBlock = async (id: string) => {
    if (!report) return;
    const block = report.blocks.find((b) => b.id === id);
    if (!block) return;
    if ("refId" in block && block.refId) {
      const snap = await fetchSnapshot(block as any);
      updateBlock(id, { snapshot: snap ?? undefined } as any);
      toast.success("Snapshot refreshed");
    } else if (block.type === "admin_activity" || block.type === "admin_locations") {
      const kind = block.type === "admin_activity" ? "activity" : "locations";
      const { data } = await supabase.functions.invoke("admin-data-export", {
        body: { kind, ...(block as any).filters, limit: 500 },
      });
      const rows = kind === "activity" ? (data?.activity ?? []) : (data?.locations ?? []);
      updateBlock(id, { snapshot: { rows } } as any);
      toast.success(`Loaded ${rows.length} rows`);
    }
  };

  const save = async () => {
    if (!report) return;
    setSaving(true);
    const { error } = await supabase
      .from("reports")
      .update({
        title: report.title,
        description: report.description,
        blocks: report.blocks as any,
        is_public: report.is_public,
      })
      .eq("id", report.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Report saved");
  };

  const refreshAll = async () => {
    if (!report) return;
    setSaving(true);
    const refreshed = await refreshAllSnapshots(report.blocks);
    setReport({ ...report, blocks: refreshed });
    setSaving(false);
    toast.success("All snapshots refreshed");
  };

  const addShare = async () => {
    if (!report || !shareEmail.trim()) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", `%${shareEmail.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (!prof) {
      toast.error("No user found matching that name");
      return;
    }
    const { error } = await supabase.from("report_shares").insert({
      report_id: report.id,
      shared_with_user_id: (prof as any).id,
      can_edit: false,
    });
    if (error) toast.error(error.message);
    else { toast.success("Shared"); setShareEmail(""); load(); }
  };

  const removeShare = async (id: string) => {
    const { error } = await supabase.from("report_shares").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  if (loading) return <div className="p-6 text-xs text-muted-foreground">Loading report…</div>;
  if (!report) return <div className="p-6 text-xs">Report not found.</div>;

  const selectedBlock = report.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const canEdit = isOwner || isAdmin;

  // Drag-and-drop on canvas
  const onDragStart = (e: React.DragEvent, type: ReportBlockType) => {
    e.dataTransfer.setData("blockType", type);
  };
  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("blockType") as ReportBlockType;
    const blockId = e.dataTransfer.getData("blockId");
    if (type) addBlock(type);
    else if (blockId) {
      // reorder via dragged block — append to end
    }
  };
  const onBlockDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("blockId", id);
  };

  const groups = ["Content", "Visuals", "Data", "Intelligence", "Admin", "API"] as const;

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--background))]">
      {/* Header */}
      <div className="border-b border-border bg-card px-3 py-2 flex items-center gap-2 flex-wrap">
        <button onClick={onBack} className="text-xs flex items-center gap-1 px-2 py-1 hover:bg-accent rounded">
          <ArrowLeft size={12} /> Back to Reports
        </button>
        <input
          value={report.title}
          onChange={(e) => updateReport({ title: e.target.value })}
          disabled={!canEdit}
          className="flex-1 min-w-[200px] text-sm font-bold bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none px-1"
        />
        {canEdit && (
          <>
            <button onClick={save} disabled={saving} className="text-xs flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
            </button>
            <button onClick={refreshAll} disabled={saving} className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded hover:bg-accent">
              <RefreshCw size={12} /> Refresh All
            </button>
          </>
        )}
        <button onClick={() => { void exportReportPdf(report); }} className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded hover:bg-accent">
          <Download size={12} /> PDF
        </button>
        <button onClick={() => exportReportCsv(report)} className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded hover:bg-accent">
          <FileText size={12} /> CSV
        </button>
        {isOwner && (
          <button onClick={() => setShowShare((s) => !s)} className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded hover:bg-accent">
            <Share2 size={12} /> Share ({shares.length})
          </button>
        )}
        {isOwner && (
          <button onClick={() => setShowSchedules((s) => !s)} className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded hover:bg-accent">
            <Calendar size={12} /> Schedule
          </button>
        )}
      </div>

      {/* Share panel */}
      {showShare && isOwner && (
        <div className="border-b border-border bg-muted px-3 py-2 space-y-2">
          <div className="flex gap-2 items-center">
            <input
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              placeholder="Display name to share with…"
              className="flex-1 text-xs border border-border bg-background rounded px-2 py-1"
            />
            <button onClick={addShare} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded">Add</button>
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={report.is_public} onChange={(e) => updateReport({ is_public: e.target.checked })} />
              Public to all ORDB users
            </label>
          </div>
          {shares.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {shares.map((s) => (
                <span key={s.id} className="text-[10px] bg-background border border-border rounded px-2 py-0.5 flex items-center gap-1">
                  {s.shared_with_user_id.slice(0, 8)}… {s.can_edit ? "(edit)" : "(view)"}
                  <button onClick={() => removeShare(s.id)} className="text-destructive hover:text-destructive/70">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedule panel */}
      {showSchedules && isOwner && (
        <div className="border-b border-border bg-muted px-3 py-2">
          {report.is_public ? null : (
            <div className="text-[10px] text-muted-foreground mb-2 italic">
              Tip: enable "Public" in Share to give recipients a viewable link.
            </div>
          )}
          <ReportSchedules reportId={report.id} reportTitle={report.title} />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Block palette */}
        {canEdit && (
          <aside className="w-48 border-r border-border bg-card overflow-y-auto p-2 space-y-3">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Drag blocks →</div>
            {groups.map((g) => {
              const items = BLOCK_PALETTE.filter((p) => p.group === g && (!p.adminOnly || isAdmin));
              if (items.length === 0) return null;
              return (
                <div key={g}>
                  <div className="text-[10px] font-bold text-muted-foreground mb-1">{g}</div>
                  <div className="space-y-1">
                    {items.map((p) => (
                      <button
                        key={p.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, p.type)}
                        onClick={() => addBlock(p.type)}
                        className="w-full text-left text-xs flex items-center gap-2 px-2 py-1 border border-border bg-background hover:bg-accent rounded cursor-grab active:cursor-grabbing"
                      >
                        <span>{p.emoji}</span>
                        <span className="truncate">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </aside>
        )}

        {/* Canvas */}
        <main
          onDragOver={(e) => e.preventDefault()}
          onDrop={onCanvasDrop}
          className="flex-1 overflow-y-auto p-4 space-y-2 bg-background"
        >
          <textarea
            value={report.description}
            onChange={(e) => updateReport({ description: e.target.value })}
            disabled={!canEdit}
            placeholder="Report description / executive summary…"
            className="w-full text-xs border border-border bg-card rounded p-2 min-h-[60px]"
          />

          {report.blocks.length === 0 && (
            <div className="border-2 border-dashed border-border rounded p-12 text-center text-xs text-muted-foreground">
              Drag blocks from the palette to start building your report.
            </div>
          )}

          {report.blocks.map((b, idx) => (
            <div
              key={b.id}
              data-report-block-id={b.id}
              draggable={canEdit}
              onDragStart={(e) => onBlockDragStart(e, b.id)}
              onClick={() => setSelectedBlockId(b.id)}
              className={`border rounded p-2 bg-card cursor-pointer transition-colors ${
                selectedBlockId === b.id ? "border-primary ring-1 ring-primary/40" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <GripVertical size={12} />
                  <span className="font-bold uppercase">{b.type}</span>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); moveBlock(b.id, -1); }} disabled={idx === 0} className="text-[10px] px-1 hover:bg-accent rounded disabled:opacity-30">↑</button>
                    <button onClick={(e) => { e.stopPropagation(); moveBlock(b.id, 1); }} disabled={idx === report.blocks.length - 1} className="text-[10px] px-1 hover:bg-accent rounded disabled:opacity-30">↓</button>
                    <button onClick={(e) => { e.stopPropagation(); refreshBlock(b.id); }} className="text-[10px] px-1 hover:bg-accent rounded" title="Refresh"><RefreshCw size={10} /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} className="text-[10px] px-1 hover:bg-destructive/20 text-destructive rounded"><Trash2 size={10} /></button>
                  </div>
                )}
              </div>
              <BlockPreview block={b} />
            </div>
          ))}
        </main>

        {/* Properties panel */}
        {canEdit && selectedBlock && (
          <aside className="w-72 border-l border-border bg-card overflow-y-auto p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Block: {selectedBlock.type}</div>
            <BlockEditor block={selectedBlock} onChange={(patch) => updateBlock(selectedBlock.id, patch)} />
          </aside>
        )}
      </div>
    </div>
  );
}

// Inline preview rendered in the canvas
function BlockPreview({ block }: { block: ReportBlock }) {
  switch (block.type) {
    case "heading": return <div className="text-base font-bold text-primary">{block.text}</div>;
    case "subheading": return <div className="text-sm font-bold">{block.text}</div>;
    case "text": return <div className="text-xs whitespace-pre-wrap text-foreground">{block.text || <span className="text-muted-foreground italic">Empty text block</span>}</div>;
    case "image": return block.url ? <img src={block.url} alt={block.caption ?? ""} className="max-h-48 rounded" /> : <div className="text-xs text-muted-foreground italic">No image URL</div>;
    case "divider": return <hr className="border-border" />;
    case "page_break": return <div className="text-[10px] text-muted-foreground italic text-center border-t border-dashed border-border py-1">— page break —</div>;
    case "tabs": return <div className="text-xs text-muted-foreground">{block.tabs.length} tab(s): {block.tabs.map((t) => t.label).join(", ")}</div>;
    case "admin_activity": {
      const rows = (block as any).snapshot?.rows ?? [];
      return <div className="text-xs text-muted-foreground">📋 Activity logs — {rows.length} rows cached</div>;
    }
    case "admin_locations": {
      const rows = (block as any).snapshot?.rows ?? [];
      return <div className="text-xs text-muted-foreground">📍 Locations — {rows.length} points cached</div>;
    }
    case "api_data": return <div className="text-xs text-muted-foreground">🔌 API: {(block as any).endpoint}</div>;
    case "mcp_data": return <div className="text-xs text-muted-foreground">🤖 MCP: {(block as any).toolName}</div>;
    case "chart": return <ChartBlockView block={block} />;
    case "table": return <TableBlockView block={block} />;
    case "map":   return <MapBlockView block={block} />;
    default: {
      const ref = (block as any).refId;
      const snap = (block as any).snapshot;
      return (
        <div className="text-xs">
          <span className="text-muted-foreground">ref:</span> {ref || <em className="text-destructive">unset</em>}
          {snap && <span className="ml-2 text-success">✓ cached</span>}
        </div>
      );
    }
  }
}

// Right-panel editor for the selected block
function BlockEditor({ block, onChange }: { block: ReportBlock; onChange: (patch: Partial<ReportBlock>) => void }) {
  const setField = (k: string, v: unknown) => onChange({ [k]: v } as any);

  if (block.type === "heading" || block.type === "subheading" || block.type === "text") {
    return (
      <textarea
        value={block.text}
        onChange={(e) => setField("text", e.target.value)}
        rows={block.type === "text" ? 8 : 2}
        className="w-full text-xs border border-border bg-background rounded p-2"
      />
    );
  }

  if (block.type === "image") {
    return (
      <div className="space-y-2">
        <input
          value={block.url}
          onChange={(e) => setField("url", e.target.value)}
          placeholder="Image URL"
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
        <input
          value={block.caption ?? ""}
          onChange={(e) => setField("caption", e.target.value)}
          placeholder="Caption"
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
      </div>
    );
  }

  if (block.type === "tabs") {
    return (
      <div className="space-y-2">
        {block.tabs.map((t, i) => (
          <div key={t.id} className="border border-border rounded p-2 space-y-1">
            <input
              value={t.label}
              onChange={(e) => {
                const tabs = [...block.tabs];
                tabs[i] = { ...tabs[i], label: e.target.value };
                setField("tabs", tabs);
              }}
              className="w-full text-xs border border-border bg-background rounded px-2 py-1"
            />
            <div className="text-[10px] text-muted-foreground">{t.blocks.length} block(s) inside</div>
          </div>
        ))}
        <button
          onClick={() => setField("tabs", [...block.tabs, { id: crypto.randomUUID(), label: `Tab ${block.tabs.length + 1}`, blocks: [] }])}
          className="text-xs px-2 py-1 border border-border rounded hover:bg-accent w-full flex items-center justify-center gap-1"
        ><Plus size={12} /> Add tab</button>
      </div>
    );
  }

  if (block.type === "admin_activity" || block.type === "admin_locations") {
    const f = block.filters;
    return (
      <div className="space-y-2">
        <label className="block text-[10px] font-bold">User ID (optional)</label>
        <input
          value={f.user_id ?? ""}
          onChange={(e) => setField("filters", { ...f, user_id: e.target.value || null })}
          placeholder="UUID, leave empty for all"
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
        <label className="block text-[10px] font-bold">Date from</label>
        <input
          type="date"
          value={f.date_from ?? ""}
          onChange={(e) => setField("filters", { ...f, date_from: e.target.value || null })}
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
        <label className="block text-[10px] font-bold">Date to</label>
        <input
          type="date"
          value={f.date_to ?? ""}
          onChange={(e) => setField("filters", { ...f, date_to: e.target.value || null })}
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
        {block.type === "admin_locations" && (
          <label className="text-xs flex items-center gap-1">
            <input
              type="checkbox"
              checked={(block as any).showMap ?? true}
              onChange={(e) => setField("showMap", e.target.checked)}
            />
            Include map
          </label>
        )}
        <p className="text-[10px] text-muted-foreground">Click ↻ on the block to load data.</p>
      </div>
    );
  }

  if (block.type === "api_data") {
    return (
      <input
        value={(block as any).endpoint}
        onChange={(e) => setField("endpoint", e.target.value)}
        placeholder="/v1/candidates?state=MN"
        className="w-full text-xs border border-border bg-background rounded px-2 py-1"
      />
    );
  }
  if (block.type === "mcp_data") {
    return (
      <div className="space-y-2">
        <input
          value={(block as any).toolName}
          onChange={(e) => setField("toolName", e.target.value)}
          placeholder="MCP tool name"
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
        <textarea
          value={JSON.stringify((block as any).args ?? {}, null, 2)}
          onChange={(e) => { try { setField("args", JSON.parse(e.target.value)); } catch { /* ignore */ } }}
          rows={4}
          className="w-full text-xs border border-border bg-background rounded p-2 font-mono"
        />
      </div>
    );
  }

  if (block.type === "chart") {
    return (
      <div className="space-y-2">
        <select
          value={block.chartType}
          onChange={(e) => setField("chartType", e.target.value)}
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        >
          <option value="bar">Bar</option>
          <option value="line">Line</option>
          <option value="pie">Pie</option>
        </select>
        <label className="block text-[10px] font-bold">Data (JSON array of {`{label, value, ...}`})</label>
        <textarea
          value={JSON.stringify(block.data, null, 2)}
          onChange={(e) => { try { setField("data", JSON.parse(e.target.value)); } catch { /* ignore */ } }}
          rows={6}
          className="w-full text-xs border border-border bg-background rounded p-2 font-mono"
        />
        <input
          value={(block.series ?? ["value"]).join(",")}
          onChange={(e) => setField("series", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
          placeholder="series keys (comma-separated)"
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
        <input
          value={block.caption ?? ""}
          onChange={(e) => setField("caption", e.target.value)}
          placeholder="Caption"
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
      </div>
    );
  }

  if (block.type === "table") {
    return (
      <div className="space-y-2">
        <input
          value={block.columns.join(",")}
          onChange={(e) => setField("columns", e.target.value.split(",").map((s) => s.trim()))}
          placeholder="Columns (comma-separated)"
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
        <label className="block text-[10px] font-bold">Rows (JSON array of arrays)</label>
        <textarea
          value={JSON.stringify(block.rows, null, 2)}
          onChange={(e) => { try { setField("rows", JSON.parse(e.target.value)); } catch { /* ignore */ } }}
          rows={6}
          className="w-full text-xs border border-border bg-background rounded p-2 font-mono"
        />
        <input
          value={block.caption ?? ""}
          onChange={(e) => setField("caption", e.target.value)}
          placeholder="Caption"
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
      </div>
    );
  }

  if (block.type === "map") {
    return (
      <div className="space-y-2">
        <select
          value={block.mode}
          onChange={(e) => setField("mode", e.target.value)}
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        >
          <option value="districts">District highlights</option>
          <option value="points">GPS points</option>
        </select>
        {block.mode === "districts" ? (
          <input
            value={(block.districts ?? []).join(",")}
            onChange={(e) => setField("districts", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            placeholder="MN-05, TX-22, CA-12"
            className="w-full text-xs border border-border bg-background rounded px-2 py-1"
          />
        ) : (
          <textarea
            value={JSON.stringify(block.points ?? [], null, 2)}
            onChange={(e) => { try { setField("points", JSON.parse(e.target.value)); } catch { /* ignore */ } }}
            rows={5}
            placeholder='[{"lat":44.97,"lng":-93.26,"label":"Mpls"}]'
            className="w-full text-xs border border-border bg-background rounded p-2 font-mono"
          />
        )}
        <input
          value={block.caption ?? ""}
          onChange={(e) => setField("caption", e.target.value)}
          placeholder="Caption"
          className="w-full text-xs border border-border bg-background rounded px-2 py-1"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold">Reference ID</label>
      <input
        value={(block as any).refId ?? ""}
        onChange={(e) => setField("refId", e.target.value)}
        placeholder={
          block.type === "candidate" ? "candidate slug" :
          block.type === "district" ? "MN-05" :
          block.type === "intel" ? "national:economy" :
          block.type === "international" ? "USA" :
          block.type === "election" ? "MN-05" :
          block.type === "legislation" ? "hr1234-119" :
          block.type === "talking_points" ? "candidate-slug or bill_id" :
          block.type === "vulnerability" ? "candidate-slug" :
          block.type === "bill_impact" ? "hr1234-119" :
          block.type === "forecast" ? "MN-05 or MN" :
          block.type === "prediction_market" ? "market id or slug" :
          block.type === "investigations" ? "MN or person/org name" :
          block.type === "war_room" ? "war room UUID" :
          block.type === "entity_graph" ? "candidate:tina-smith" :
          "reference id"
        }
        className="w-full text-xs border border-border bg-background rounded px-2 py-1"
      />
      <label className="block text-[10px] font-bold">Custom title (optional)</label>
      <input
        value={block.title ?? ""}
        onChange={(e) => setField("title", e.target.value)}
        className="w-full text-xs border border-border bg-background rounded px-2 py-1"
      />
      <p className="text-[10px] text-muted-foreground">Click ↻ on the block to fetch latest snapshot.</p>
    </div>
  );
}
