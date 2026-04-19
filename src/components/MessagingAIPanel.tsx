import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, Target, BarChart3, Sparkles, Settings2, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface MessagingAIPanelProps {
  messagingSlug: string;
  messagingTitle: string;
  issueAreas: string[];
  /** When provided, renders "Save to item" buttons that append generated artifacts to the messaging item's content. */
  onSaveToItem?: (markdown: string, kind: "talking" | "audience" | "impact") => Promise<void> | void;
  canSaveToItem?: boolean;
}

const ALL_SECTIONS = [
  { key: "polling", label: "Polling" },
  { key: "intel", label: "Intel" },
  { key: "legislation", label: "Legislation" },
  { key: "finance", label: "Finance" },
  { key: "forecasts", label: "Forecasts" },
  { key: "international", label: "International" },
];

const MODELS = [
  "google/gemini-2.5-pro",
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5.2",
];

type SubTab = "talking" | "audience" | "impact";

export function MessagingAIPanel({ messagingSlug, messagingTitle, issueAreas, onSaveToItem, canSaveToItem }: MessagingAIPanelProps) {
  const [tab, setTab] = useState<SubTab>("talking");

  // Shared settings
  const [model, setModel] = useState("google/gemini-2.5-pro");
  const [sections, setSections] = useState<string[]>(["polling", "intel", "legislation", "forecasts"]);
  const [showSettings, setShowSettings] = useState(false);

  // Talking points state
  const [audience, setAudience] = useState("swing");
  const [angle, setAngle] = useState("persuasion");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [count, setCount] = useState(5);
  const [customInstr, setCustomInstr] = useState("");
  const [tpLoading, setTpLoading] = useState(false);
  const [tp, setTp] = useState<any>(null);
  const [tpHistory, setTpHistory] = useState<any[]>([]);
  const [showTpHistory, setShowTpHistory] = useState(false);

  // Audience analysis state
  const [audLoading, setAudLoading] = useState(false);
  const [audience_analysis, setAudienceAnalysis] = useState<any>(null);

  // Impact state
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactScope, setImpactScope] = useState("national");
  const [impactScopeRef, setImpactScopeRef] = useState("");
  const [impact, setImpact] = useState<any>(null);
  const [savingKind, setSavingKind] = useState<string | null>(null);

  function toggleSection(key: string) {
    setSections((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  async function loadCached() {
    const [tpRes, audRes, impRes, hist] = await Promise.all([
      supabase.from("talking_points").select("*").eq("subject_type", "messaging").eq("subject_ref", messagingSlug).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("messaging_audience_analyses").select("*").eq("messaging_slug", messagingSlug).maybeSingle(),
      supabase.from("messaging_impact_analyses").select("*").eq("messaging_slug", messagingSlug).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("talking_points").select("*").eq("subject_type", "messaging").eq("subject_ref", messagingSlug).order("created_at", { ascending: false }).limit(20),
    ]);
    if (tpRes.data) setTp(tpRes.data);
    if (audRes.data) setAudienceAnalysis(audRes.data);
    if (impRes.data) setImpact(impRes.data);
    setTpHistory((hist.data as any[]) || []);
  }

  useEffect(() => { loadCached(); }, [messagingSlug]);

  async function genTalking() {
    setTpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("messaging-talking-points", {
        body: {
          messaging_slug: messagingSlug, audience, angle, tone, length, count,
          include_evidence: true, include_sections: sections, custom_instructions: customInstr, model,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTp(data.talking_points);
      loadCached();
      toast.success("Talking points generated");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setTpLoading(false); }
  }

  async function genAudience(force = false) {
    setAudLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("messaging-audience-analysis", {
        body: { messaging_slug: messagingSlug, force_refresh: force, include_sections: sections, model },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAudienceAnalysis(data.analysis);
      toast.success(data.cached ? "Loaded cached audience analysis" : "Audience analysis generated");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setAudLoading(false); }
  }

  async function genImpact(force = false) {
    setImpactLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("messaging-impact", {
        body: { messaging_slug: messagingSlug, scope: impactScope, scope_ref: impactScopeRef || null, force_refresh: force, include_sections: sections, model },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setImpact(data.analysis);
      toast.success(data.cached ? "Loaded cached impact analysis" : "Impact analysis generated");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setImpactLoading(false); }
  }

  // savingKind hook moved up with other hooks
  function tpToMarkdown(t: any) {
    const lines = [`### 🗣️ Talking Points — ${t.audience}/${t.angle} _(${t.model})_`];
    (t.points || []).forEach((p: any, i: number) => {
      lines.push(`${i + 1}. **${p.message}**`);
      if (p.rationale) lines.push(`   - _Why:_ ${p.rationale}`);
      if (p.delivery_tips) lines.push(`   - _Tip:_ ${p.delivery_tips}`);
    });
    if ((t.evidence || []).length) {
      lines.push(`\n**Evidence**`);
      t.evidence.forEach((e: any) => lines.push(`- ${e.claim}${e.source_hint ? ` — ${e.source_hint}` : ""}`));
    }
    return lines.join("\n");
  }
  function audToMarkdown(a: any) {
    const lines = [`### 🎯 Audience Effectiveness — ${Math.round(a.effectiveness_score)}/100`];
    if (a.summary) lines.push(a.summary);
    if (a.audience_scores) {
      lines.push(`\n**Audience scores:** ${Object.entries(a.audience_scores).map(([k, v]: any) => `${k} ${Math.round(v as number)}`).join(" · ")}`);
    }
    (a.segment_breakdown || []).forEach((s: any) => lines.push(`- **${s.segment}** (${s.score}/100): ${s.reasoning}`));
    if ((a.risks || []).length) {
      lines.push(`\n**Risks**`);
      a.risks.forEach((r: any) => lines.push(`- _[${r.severity}]_ **${r.headline}** — ${r.summary}`));
    }
    return lines.join("\n");
  }
  function impactToMarkdown(im: any) {
    const lines = [`### 📊 Impact — ${im.scope}${im.scope_ref ? ` · ${im.scope_ref}` : ""}`];
    if (im.summary) lines.push(im.summary);
    if ((im.amplifies || []).length) {
      lines.push(`\n**Amplifies**`);
      im.amplifies.forEach((a: any) => lines.push(`- **${a.group}** — ${a.why}`));
    }
    if ((im.undermines || []).length) {
      lines.push(`\n**Undermines**`);
      im.undermines.forEach((a: any) => lines.push(`- **${a.group}** — ${a.why}`));
    }
    if (im.political_impact) lines.push(`\n**Political:** ${im.political_impact}`);
    if (im.media_impact) lines.push(`**Media:** ${im.media_impact}`);
    return lines.join("\n");
  }
  async function handleSave(kind: "talking" | "audience" | "impact") {
    if (!onSaveToItem) return;
    const md = kind === "talking" ? tpToMarkdown(tp) : kind === "audience" ? audToMarkdown(audience_analysis) : impactToMarkdown(impact);
    setSavingKind(kind);
    try { await onSaveToItem(md, kind); } finally { setSavingKind(null); }
  }

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> AI Messaging Tools
        </div>
        <button onClick={() => setShowSettings((v) => !v)} className="win98-button text-[10px] px-1.5 py-0.5 flex items-center gap-1">
          <Settings2 className="h-3 w-3" /> {showSettings ? "Hide" : "Settings"}
        </button>
      </div>

      {showSettings && (
        <div className="bg-white border border-[hsl(var(--win98-shadow))] p-2 mb-2 space-y-1.5 text-[10px]">
          <div>
            <div className="font-bold mb-1">Cross-section context</div>
            <div className="flex flex-wrap gap-1">
              {ALL_SECTIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-1">
                  <input type="checkbox" checked={sections.includes(s.key)} onChange={() => toggleSection(s.key)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <span className="font-bold">Model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="win98-input text-[10px] px-1 py-0.5 flex-1">
              {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-2">
        <button onClick={() => setTab("talking")} className={`win98-button text-[10px] px-2 py-0.5 flex items-center gap-1 ${tab === "talking" ? "font-bold" : ""}`}>
          <MessageSquare className="h-3 w-3" /> Talking Points
        </button>
        <button onClick={() => setTab("audience")} className={`win98-button text-[10px] px-2 py-0.5 flex items-center gap-1 ${tab === "audience" ? "font-bold" : ""}`}>
          <Target className="h-3 w-3" /> Audience Fit
        </button>
        <button onClick={() => setTab("impact")} className={`win98-button text-[10px] px-2 py-0.5 flex items-center gap-1 ${tab === "impact" ? "font-bold" : ""}`}>
          <BarChart3 className="h-3 w-3" /> Impact
        </button>
      </div>

      {tab === "talking" && (
        <div>
          <div className="flex flex-wrap gap-1 mb-2">
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className="win98-input text-[10px] px-1 py-0.5">
              <option value="general">General</option><option value="press">Press</option><option value="donors">Donors</option>
              <option value="volunteers">Volunteers</option><option value="base">Base</option><option value="swing">Swing</option>
              <option value="independents">Independents</option>
            </select>
            <select value={angle} onChange={(e) => setAngle(e.target.value)} className="win98-input text-[10px] px-1 py-0.5">
              <option value="persuasion">Persuasion</option><option value="attack">Attack</option>
              <option value="defense">Defense</option><option value="contrast">Contrast</option><option value="rebuttal">Rebuttal</option>
            </select>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="win98-input text-[10px] px-1 py-0.5">
              <option value="professional">Professional</option><option value="aggressive">Aggressive</option>
              <option value="empathetic">Empathetic</option><option value="folksy">Folksy</option>
              <option value="urgent">Urgent</option>
            </select>
            <select value={length} onChange={(e) => setLength(e.target.value)} className="win98-input text-[10px] px-1 py-0.5">
              <option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
            </select>
            <input type="number" min={1} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} className="win98-input text-[10px] px-1 py-0.5 w-12" />
            <button onClick={genTalking} disabled={tpLoading} className="win98-button text-[10px] px-2 py-0.5">
              {tpLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
            </button>
            <button onClick={() => setShowTpHistory((v) => !v)} className="win98-button text-[10px] px-1.5 py-0.5 flex items-center gap-1">
              <History className="h-3 w-3" /> History ({tpHistory.length})
            </button>
          </div>
          <textarea value={customInstr} onChange={(e) => setCustomInstr(e.target.value)} rows={2} placeholder="Custom instructions (optional)…" className="win98-input text-[10px] px-1 py-0.5 w-full mb-2" />
          {showTpHistory && tpHistory.length > 0 && (
            <div className="bg-white border border-[hsl(var(--win98-shadow))] p-1.5 mb-2 max-h-32 overflow-auto">
              {tpHistory.map((h) => (
                <button key={h.id} onClick={() => setTp(h)} className="block w-full text-left text-[10px] hover:bg-blue-100 px-1 py-0.5 border-b border-gray-200">
                  {new Date(h.created_at).toLocaleString()} — {h.audience}/{h.angle} · {h.points?.length || 0} pts
                </button>
              ))}
            </div>
          )}
          {tp && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold opacity-70">{tp.audience}/{tp.angle} · {tp.model}</div>
              {(tp.points || []).map((p: any, i: number) => (
                <div key={i} className="bg-white border border-[hsl(var(--win98-shadow))] p-1.5 text-[10px]">
                  <div className="font-bold">{i + 1}. {p.message}</div>
                  <div className="opacity-80 mt-0.5"><span className="font-bold">Why:</span> {p.rationale}</div>
                  {p.delivery_tips && <div className="opacity-70 italic mt-0.5">Tip: {p.delivery_tips}</div>}
                </div>
              ))}
              {(tp.evidence || []).length > 0 && (
                <>
                  <div className="text-[10px] font-bold mt-2">Evidence</div>
                  {tp.evidence.map((e: any, i: number) => (
                    <div key={i} className="text-[9px] bg-yellow-50 border border-yellow-300 p-1">• {e.claim}{e.source_hint ? ` — ${e.source_hint}` : ""}</div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "audience" && (
        <div>
          <div className="flex gap-1 mb-2">
            <button onClick={() => genAudience(false)} disabled={audLoading} className="win98-button text-[10px] px-2 py-0.5">
              {audLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Analyze"}
            </button>
            {audience_analysis && (
              <button onClick={() => genAudience(true)} disabled={audLoading} className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
            )}
          </div>
          {audience_analysis && (
            <div className="space-y-2 text-[10px]">
              <div className="bg-white border border-[hsl(var(--win98-shadow))] p-2">
                <div className="font-bold mb-1">Overall Effectiveness: {Math.round(audience_analysis.effectiveness_score)}/100</div>
                <p className="opacity-80">{audience_analysis.summary}</p>
              </div>
              {audience_analysis.audience_scores && (
                <div className="grid grid-cols-3 gap-1">
                  {Object.entries(audience_analysis.audience_scores).map(([k, v]: any) => (
                    <div key={k} className="bg-white border border-[hsl(var(--win98-shadow))] p-1 text-center">
                      <div className="text-[9px] uppercase opacity-70">{k}</div>
                      <div className="font-bold">{Math.round(v as number)}</div>
                    </div>
                  ))}
                </div>
              )}
              {(audience_analysis.segment_breakdown || []).length > 0 && (
                <div>
                  <div className="font-bold mb-1">Segment breakdown</div>
                  {audience_analysis.segment_breakdown.map((s: any, i: number) => (
                    <div key={i} className="bg-white border border-[hsl(var(--win98-shadow))] p-1 mb-1">
                      <div className="font-bold">{s.segment} ({s.score}/100)</div>
                      <div className="opacity-80">{s.reasoning}</div>
                    </div>
                  ))}
                </div>
              )}
              {(audience_analysis.risks || []).length > 0 && (
                <div>
                  <div className="font-bold mb-1">Risks</div>
                  {audience_analysis.risks.map((r: any, i: number) => (
                    <div key={i} className="bg-red-50 border border-red-300 p-1 mb-1">
                      <div className="font-bold">{r.headline} <span className="text-[8px] opacity-70">[{r.severity}]</span></div>
                      <div className="opacity-80">{r.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "impact" && (
        <div>
          <div className="flex gap-1 mb-2 items-center flex-wrap">
            <select value={impactScope} onChange={(e) => setImpactScope(e.target.value)} className="win98-input text-[10px] px-1 py-0.5">
              <option value="national">National</option><option value="state">State</option><option value="district">District</option>
            </select>
            {impactScope !== "national" && (
              <input value={impactScopeRef} onChange={(e) => setImpactScopeRef(e.target.value)} placeholder={impactScope === "state" ? "e.g. MN" : "e.g. MN-02"} className="win98-input text-[10px] px-1 py-0.5 w-24" />
            )}
            <button onClick={() => genImpact(false)} disabled={impactLoading} className="win98-button text-[10px] px-2 py-0.5">
              {impactLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Analyze"}
            </button>
            {impact && (
              <button onClick={() => genImpact(true)} disabled={impactLoading} className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
            )}
          </div>
          {impact && (
            <div className="space-y-2 text-[10px]">
              <div className="bg-white border border-[hsl(var(--win98-shadow))] p-2">
                <div className="font-bold mb-1">{impact.scope}{impact.scope_ref ? ` · ${impact.scope_ref}` : ""}</div>
                <p className="opacity-80">{impact.summary}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="font-bold text-green-700 mb-1">Amplifies</div>
                  {(impact.amplifies || []).map((a: any, i: number) => (
                    <div key={i} className="bg-green-50 border border-green-300 p-1 mb-1">
                      <div className="font-bold">{a.group}</div>
                      <div className="opacity-80">{a.why}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="font-bold text-red-700 mb-1">Undermines</div>
                  {(impact.undermines || []).map((a: any, i: number) => (
                    <div key={i} className="bg-red-50 border border-red-300 p-1 mb-1">
                      <div className="font-bold">{a.group}</div>
                      <div className="opacity-80">{a.why}</div>
                    </div>
                  ))}
                </div>
              </div>
              {impact.political_impact && <div className="bg-white border border-[hsl(var(--win98-shadow))] p-1.5"><span className="font-bold">Political:</span> {impact.political_impact}</div>}
              {impact.media_impact && <div className="bg-white border border-[hsl(var(--win98-shadow))] p-1.5"><span className="font-bold">Media:</span> {impact.media_impact}</div>}
              {(impact.recommended_channels || []).length > 0 && (
                <div>
                  <div className="font-bold mb-1">Recommended channels</div>
                  {impact.recommended_channels.map((c: any, i: number) => (
                    <div key={i} className="bg-white border border-[hsl(var(--win98-shadow))] p-1 mb-1">
                      <span className="font-bold">{c.channel}:</span> {c.rationale}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
