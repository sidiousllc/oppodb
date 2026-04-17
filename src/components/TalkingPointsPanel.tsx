import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, Save } from "lucide-react";
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
}

export function TalkingPointsPanel({ subjectType, subjectRef }: { subjectType: string; subjectRef: string }) {
  const [audience, setAudience] = useState("general");
  const [angle, setAngle] = useState("attack");
  const [tp, setTp] = useState<Tp | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("talking-points", {
        body: { subject_type: subjectType, subject_ref: subjectRef, audience, angle },
      });
      if (error) throw error;
      setTp(data.talking_points);
      toast.success("Talking points generated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate");
    } finally {
      setLoading(false);
    }
  }

  function buildMarkdown(tp: Tp): string {
    const date = new Date().toISOString().slice(0, 10);
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
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
      <div className="text-[11px] font-bold mb-2 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> AI Talking Points</div>
      <div className="flex gap-2 mb-2">
        <select value={audience} onChange={(e) => setAudience(e.target.value)} className="win98-input text-[10px] px-1 py-0.5 flex-1">
          <option value="general">General</option>
          <option value="press">Press</option>
          <option value="donors">Donors</option>
          <option value="volunteers">Volunteers</option>
          <option value="base">Base voters</option>
        </select>
        <select value={angle} onChange={(e) => setAngle(e.target.value)} className="win98-input text-[10px] px-1 py-0.5 flex-1">
          <option value="attack">Attack</option>
          <option value="defense">Defense</option>
          <option value="contrast">Contrast</option>
          <option value="persuasion">Persuasion</option>
        </select>
        <button onClick={generate} disabled={loading} className="win98-button text-[10px] px-2 py-0.5">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
        </button>
      </div>
      {tp && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold">Points</div>
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
