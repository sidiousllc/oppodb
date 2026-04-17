import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Win98PageLayout } from "./Win98PageLayout";
import { Win98Window } from "./Win98Window";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { Loader2, Network, Save, Wand2 } from "lucide-react";

interface Node { id: string; type: string; label: string; }
interface Edge { id: string; source: string; target: string; type: string; amount?: number | null; }

const NODE_COLORS: Record<string, string> = {
  candidate: "hsl(0, 70%, 55%)",
  member: "hsl(220, 70%, 55%)",
  donor: "hsl(120, 50%, 45%)",
  client: "hsl(280, 50%, 50%)",
  lobbyist: "hsl(30, 80%, 55%)",
  agency: "hsl(200, 50%, 45%)",
  contractor: "hsl(160, 50%, 45%)",
  bill: "hsl(50, 80%, 50%)",
  default: "hsl(0, 0%, 50%)",
};

export function GraphHub() {
  const [entityType, setEntityType] = useState("candidate");
  const [entityId, setEntityId] = useState("");
  const [depth, setDepth] = useState(1);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function loadSnapshots() {
    const { data } = await supabase.from("graph_snapshots").select("*").order("created_at", { ascending: false }).limit(20);
    setSnapshots(data ?? []);
  }
  useEffect(() => { loadSnapshots(); }, []);

  async function buildGraph() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(`entity-graph?action=build`);
      if (error) throw error;
      toast.success(`Built graph: ${data?.inserted ?? 0} relationships`);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }

  async function expand() {
    if (!entityId) { toast.error("Enter an entity ID"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(`entity-graph?action=expand&entity_type=${entityType}&entity_id=${entityId}&depth=${depth}`);
      if (error) throw error;
      setNodes(data?.nodes ?? []);
      setEdges(data?.edges ?? []);
      toast.success(`${data?.nodes?.length ?? 0} nodes, ${data?.edges?.length ?? 0} edges`);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }

  async function saveSnapshot() {
    const name = prompt("Snapshot name?");
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sign in"); return; }
    const { error } = await supabase.from("graph_snapshots").insert({
      user_id: u.user.id, name, root_entity_type: entityType, root_entity_id: entityId,
      graph_data: { nodes, edges } as any, filters: { depth } as any,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); loadSnapshots(); }
  }

  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width = canvas.offsetWidth;
    const h = canvas.height = 500;

    const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      positions.set(n.id, { x: w / 2 + Math.cos(angle) * 150, y: h / 2 + Math.sin(angle) * 150, vx: 0, vy: 0 });
    });

    let frame = 0;
    let raf: number;
    function tick() {
      frame++;
      for (const [id, p] of positions) {
        for (const [id2, p2] of positions) {
          if (id === id2) continue;
          const dx = p.x - p2.x, dy = p.y - p2.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const force = 2000 / d2;
          p.vx += dx * force * 0.001;
          p.vy += dy * force * 0.001;
        }
      }
      for (const e of edges) {
        const a = positions.get(e.source), b = positions.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const target = 120;
        const force = (d - target) * 0.02;
        a.vx += (dx / d) * force; a.vy += (dy / d) * force;
        b.vx -= (dx / d) * force; b.vy -= (dy / d) * force;
      }
      for (const p of positions.values()) {
        p.x += p.vx * 0.5; p.y += p.vy * 0.5;
        p.vx *= 0.85; p.vy *= 0.85;
        p.x = Math.max(30, Math.min(w - 30, p.x));
        p.y = Math.max(30, Math.min(h - 30, p.y));
      }

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(120,120,120,0.5)";
      ctx.lineWidth = 1;
      for (const e of edges) {
        const a = positions.get(e.source), b = positions.get(e.target);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const n of nodes) {
        const p = positions.get(n.id)!;
        ctx.fillStyle = NODE_COLORS[n.type] ?? NODE_COLORS.default;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "black"; ctx.font = "10px sans-serif";
        ctx.fillText(n.label.slice(0, 24), p.x + 10, p.y + 3);
      }

      if (frame < 200) raf = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges]);

  return (
    <Win98PageLayout title="Entity Graph">
      <div className="space-y-3">
        <Win98Window title="🕸️ Build & Explore">
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div>
                <Label className="text-[11px]">Entity type</Label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="candidate">Candidate</SelectItem>
                    <SelectItem value="member">Member of Congress</SelectItem>
                    <SelectItem value="donor">Donor</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="lobbyist">Lobbyist</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="bill">Bill</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-[11px]">Entity ID (slug or bioguide)</Label>
                <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="e.g. john-smith or M001234" className="h-7 text-[11px]" />
              </div>
              <div>
                <Label className="text-[11px]">Depth: {depth}</Label>
                <Select value={String(depth)} onValueChange={(v) => setDepth(Number(v))}>
                  <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hop</SelectItem>
                    <SelectItem value="2">2 hops</SelectItem>
                    <SelectItem value="3">3 hops</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={expand} disabled={loading} className="text-[11px]">
                {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Network className="w-3 h-3 mr-1" />}Expand
              </Button>
              <Button size="sm" variant="outline" onClick={buildGraph} disabled={loading} className="text-[11px]">
                <Wand2 className="w-3 h-3 mr-1" />Bulk-build from data
              </Button>
              {nodes.length > 0 && <Button size="sm" variant="outline" onClick={saveSnapshot} className="text-[11px]"><Save className="w-3 h-3 mr-1" />Save snapshot</Button>}
            </div>
          </div>
        </Win98Window>

        <Win98Window title={`Visualization · ${nodes.length} nodes · ${edges.length} edges`}>
          <div className="p-2">
            <canvas ref={canvasRef} className="w-full border-2 border-[hsl(var(--win98-shadow))] bg-white" style={{ height: 500 }} />
            {nodes.length === 0 && <div className="text-[11px] text-muted-foreground mt-2 p-3 text-center">No graph loaded. Bulk-build first, then enter an entity ID and click Expand.</div>}
            <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
              {Object.entries(NODE_COLORS).filter(([k]) => k !== "default").map(([k, c]) => (
                <div key={k} className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: c }} />{k}</div>
              ))}
            </div>
          </div>
        </Win98Window>

        <Win98Window title="Saved snapshots">
          <div className="p-2 space-y-1">
            {snapshots.length === 0 ? <div className="text-[11px] text-muted-foreground p-2">No snapshots saved.</div> : snapshots.map(s => (
              <div key={s.id} className="flex items-center justify-between p-2 border-2 border-[hsl(var(--win98-shadow))] text-[11px] cursor-pointer hover:bg-[hsl(var(--win98-face))]"
                onClick={() => { setNodes(s.graph_data?.nodes ?? []); setEdges(s.graph_data?.edges ?? []); setEntityType(s.root_entity_type); setEntityId(s.root_entity_id); }}>
                <div><span className="font-bold">{s.name}</span> <span className="text-muted-foreground">· {s.root_entity_type}/{s.root_entity_id}</span></div>
                <div className="text-muted-foreground">{(s.graph_data?.nodes?.length ?? 0)}n / {(s.graph_data?.edges?.length ?? 0)}e</div>
              </div>
            ))}
          </div>
        </Win98Window>
      </div>
    </Win98PageLayout>
  );
}
