import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, Save, Settings2, History } from "lucide-react";
import { toast } from "sonner";
import { updateContent } from "@/lib/contentAdmin";

interface Point { message: string; rationale: string; delivery_tips?: string }
interface Tp {
  id: string;
  audience: string;
  angle: string;
  points: Point[];
  evidence: { claim: string; source_hint?: string }[];
  created_at: string;
  model?: string;
}

const SAVED_MARKER = "## 🗣️ Talking Points";

export function TalkingPointsPanel({ subjectType, subjectRef }: { subjectType: string; subjectRef: string }) {
  const [audience, setAudience] = useState("general");
  const [angle, setAngle] = useState("attack");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [count, setCount] = useState(5);
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [model, setModel] = useState("google/gemini-2.5-pro");
  const [customInstructions, setCustomInstructions] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [tp, setTp] = useState<Tp | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<Tp[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [savedSections, setSavedSections] = useState<string[]>([]);

  async function loadHistory() {
    const { data } = await supabase
      .from("talking_points")
      .select("*")
      .eq("subject_type", subjectType)
      .eq("subject_ref", subjectRef)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as any) || []);
  }

  async function loadSavedFromProfile() {
    if (subjectType !== "candidate") return;
    const { data } = await supabase
      .from("candidate_profiles")
      .select("content")
      .eq("slug", subjectRef)
      .eq("is_subpage", false)
      .maybeSingle();
    if (!data?.content) { setSavedSections([]); return; }
    // Split by talking-points marker; keep only blocks that begin with the marker
    const parts = data.content.split(/(?=## 🗣️ Talking Points)/g).filter((p) => p.startsWith(SAVED_MARKER));
    setSavedSections(parts.map((p) => p.trim()));
  }

  useEffect(() => {
    loadHistory();
    loadSavedFromProfile();
  }, [subjectType, subjectRef]);

  async function generate() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("talking-points", {
        body: {
          subject_type: subjectType,
          subject_ref: subjectRef,
          audience, angle, tone, length, count,
          include_evidence: includeEvidence,
          custom_instructions: customInstructions,
          model,
        },
      });
      if (error) throw error;
      setTp(data.talking_points);
      loadHistory();
      toast.success("Talking points generated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate");
    } finally {
      setLoading(false);
    }
  }

  function buildMarkdown(tp: Tp): string {
    const date = new Date(tp.created_at || Date.now()).toISOString().slice(0, 10);
    const lines: string[] = [];
    lines.push(`\n\n## 🗣️ Talking Points — ${tp.audience} / ${tp.angle} (${date})\n`);
    tp.points.forEach((p, i) => {
      lines.push(`${i + 1}. **${p.message}**`);
      lines.push(`   - _Why:_ ${p.rationale}`);
      if (p.delivery_tips) lines.push(`   - _Tip:_ ${p.delivery_tips}`);
    });
    if (tp.evidence?.length) {
      lines.push(`\n**Evidence to cite:**`);
      tp.evidence.forEach((e) => {
        lines.push(`- ${e.claim}${e.source_hint ? ` — ${e.source_hint}` : ""}`);
      });
    }
    return lines.join("\n");
  }

  async function saveToProfile() {
    if (!tp || subjectType !== "candidate") return;
    setSaving(true);
    try {
      const { data: profile, error: fetchErr } = await supabase
        .from("candidate_profiles")
        .select("id, content")
        .eq("slug", subjectRef)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!profile) throw new Error("Candidate profile not found");

      const newContent = (profile.content || "") + buildMarkdown(tp);
      await updateContent("candidate_profiles", profile.id, { content: newContent });
      toast.success("Talking points saved to candidate profile");
      loadSavedFromProfile();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold flex items-center gap-1"><MessageSquare className="h-3 w-3" /> AI Talking Points</div>
        <div className="flex gap-1">
          <button onClick={() => setShowAdvanced((v) => !v)} className="win98-button text-[10px] px-1.5 py-0.5 flex items-center gap-1">
            <Settings2 className="h-3 w-3" /> {showAdvanced ? "Hide" : "Settings"}
          </button>
          <button onClick={() => setShowHistory((v) => !v)} className="win98-button text-[10px] px-1.5 py-0.5 flex items-center gap-1">
            <History className="h-3 w-3" /> History ({history.length})
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        <select value={audience} onChange={(e) => setAudience(e.target.value)} className="win98-input text-[10px] px-1 py-0.5 flex-1">
          <option value="general">General</option>
          <option value="press">Press</option>
          <option value="donors">Donors</option>
          <option value="volunteers">Volunteers</option>
          <option value="base">Base voters</option>
          <option value="swing">Swing voters</option>
          <option value="independents">Independents</option>
        </select>
        <select value={angle} onChange={(e) => setAngle(e.target.value)} className="win98-input text-[10px] px-1 py-0.5 flex-1">
          <option value="attack">Attack</option>
          <option value="defense">Defense</option>
          <option value="contrast">Contrast</option>
          <option value="persuasion">Persuasion</option>
          <option value="rebuttal">Rebuttal</option>
          <option value="endorsement">Endorsement</option>
        </select>
        <button onClick={generate} disabled={loading} className="win98-button text-[10px] px-2 py-0.5">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
        </button>
      </div>

      {showAdvanced && (
        <div className="bg-white border border-[hsl(var(--win98-shadow))] p-2 mb-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] flex flex-col gap-0.5">
              <span className="font-bold">Tone</span>
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="win98-input text-[10px] px-1 py-0.5">
                <option value="professional">Professional</option>
                <option value="aggressive">Aggressive</option>
                <option value="empathetic">Empathetic</option>
                <option value="folksy">Folksy / Plainspoken</option>
                <option value="academic">Academic</option>
                <option value="urgent">Urgent</option>
                <option value="humorous">Humorous</option>
              </select>
            </label>
            <label className="text-[10px] flex flex-col gap-0.5">
              <span className="font-bold">Length</span>
              <select value={length} onChange={(e) => setLength(e.target.value)} className="win98-input text-[10px] px-1 py-0.5">
                <option value="short">Short (1 sentence)</option>
                <option value="medium">Medium (2-3 sentences)</option>
                <option value="long">Long (paragraph)</option>
              </select>
            </label>
            <label className="text-[10px] flex flex-col gap-0.5">
              <span className="font-bold">Count: {count}</span>
              <input type="range" min={1} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </label>
            <label className="text-[10px] flex flex-col gap-0.5">
              <span className="font-bold">Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} className="win98-input text-[10px] px-1 py-0.5">
                <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                <option value="openai/gpt-5">GPT-5</option>
                <option value="openai/gpt-5-mini">GPT-5 Mini</option>
              </select>
            </label>
          </div>
          <label className="text-[10px] flex items-center gap-1">
            <input type="checkbox" checked={includeEvidence} onChange={(e) => setIncludeEvidence(e.target.checked)} />
            Include evidence section
          </label>
          <label className="text-[10px] flex flex-col gap-0.5">
            <span className="font-bold">Custom instructions (optional)</span>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. Focus on healthcare and rural voters; avoid mentioning the primary opponent."
              className="win98-input text-[10px] px-1 py-0.5"
            />
          </label>
        </div>
      )}

      {showHistory && history.length > 0 && (
        <div className="bg-white border border-[hsl(var(--win98-shadow))] p-1.5 mb-2 max-h-40 overflow-auto">
          <div className="text-[10px] font-bold mb-1">Past generations</div>
          {history.map((h) => (
            <button
              key={h.id}
              onClick={() => setTp(h)}
              className="block w-full text-left text-[10px] hover:bg-blue-100 px-1 py-0.5 border-b border-gray-200"
            >
              {new Date(h.created_at).toLocaleString()} — {h.audience}/{h.angle} · {h.points?.length || 0} pts
            </button>
          ))}
        </div>
      )}

      {subjectType === "candidate" && savedSections.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 p-2 mb-2">
          <div className="text-[10px] font-bold mb-1">📌 Saved to profile ({savedSections.length})</div>
          {savedSections.map((s, i) => {
            const headerLine = s.split("\n")[0].replace("## 🗣️ Talking Points — ", "");
            return (
              <details key={i} className="text-[10px] mb-1">
                <summary className="cursor-pointer font-bold">{headerLine}</summary>
                <pre className="whitespace-pre-wrap text-[9px] mt-1 opacity-80">{s}</pre>
              </details>
            );
          })}
        </div>
      )}

      {tp && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold">Points {tp.model ? `· ${tp.model}` : ""}</div>
            {subjectType === "candidate" && (
              <button
                onClick={saveToProfile}
                disabled={saving}
                className="win98-button text-[10px] px-2 py-0.5 flex items-center gap-1"
                title="Append these talking points to the candidate profile"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save to profile
              </button>
            )}
          </div>
          {tp.points.map((p, i) => (
            <div key={i} className="bg-white border border-[hsl(var(--win98-shadow))] p-1.5 text-[10px]">
              <div className="font-bold">{p.message}</div>
              <div className="opacity-80 mt-0.5"><span className="font-bold">Why:</span> {p.rationale}</div>
              {p.delivery_tips && <div className="opacity-70 italic mt-0.5">Tip: {p.delivery_tips}</div>}
            </div>
          ))}
          {tp.evidence?.length > 0 && (
            <>
              <div className="text-[10px] font-bold mt-2">Evidence to cite</div>
              {tp.evidence.map((e, i) => (
                <div key={i} className="text-[9px] bg-yellow-50 border border-yellow-300 p-1">
                  • {e.claim}{e.source_hint ? ` — ${e.source_hint}` : ""}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
