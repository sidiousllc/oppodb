// User news preferences: followed topics/sources, blocked sources, digest frequency.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus, X } from "lucide-react";

interface Prefs {
  followed_topics: string[];
  followed_sources: string[];
  blocked_sources: string[];
  hide_sponsored: boolean;
  digest_frequency: "off" | "daily" | "weekly";
  preferred_bias_balance: string;
}

const DEFAULT_PREFS: Prefs = {
  followed_topics: [], followed_sources: [], blocked_sources: [],
  hide_sponsored: true, digest_frequency: "weekly", preferred_bias_balance: "balanced",
};

const TOPICS = ["economy","elections","legal","defense","health","environment","immigration","education","housing","public-safety","technology","fiscal","labor","infrastructure","veterans","reproductive-rights","social-security","agriculture"];

export function NewsPreferences() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSrc, setNewSrc] = useState("");
  const [newBlock, setNewBlock] = useState("");

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data } = await supabase.from("user_news_preferences").select("*").eq("user_id", user.id).maybeSingle();
    if (data) setPrefs({
      followed_topics: data.followed_topics || [],
      followed_sources: data.followed_sources || [],
      blocked_sources: data.blocked_sources || [],
      hide_sponsored: data.hide_sponsored ?? true,
      digest_frequency: (data.digest_frequency as Prefs["digest_frequency"]) || "weekly",
      preferred_bias_balance: data.preferred_bias_balance || "balanced",
    });
    setLoading(false);
  })(); }, []);

  const save = async () => {
    if (!userId) { toast.error("Sign in required"); return; }
    const { error } = await supabase.from("user_news_preferences").upsert({ user_id: userId, ...prefs });
    if (error) toast.error(error.message); else toast.success("Preferences saved");
  };

  const toggleTopic = (t: string) => {
    setPrefs((p) => ({ ...p, followed_topics: p.followed_topics.includes(t) ? p.followed_topics.filter((x) => x !== t) : [...p.followed_topics, t] }));
  };

  if (loading) return <div className="text-xs text-gray-500 py-8 text-center">Loading preferences...</div>;
  if (!userId) return <div className="text-xs text-gray-500 py-8 text-center">Sign in to manage preferences.</div>;

  return (
    <div className="space-y-3">
      <div className="border border-[#808080] bg-white p-3 space-y-2">
        <div className="text-xs font-bold text-[#000080]">📌 Followed Topics</div>
        <div className="flex flex-wrap gap-1">
          {TOPICS.map((t) => (
            <button key={t} onClick={() => toggleTopic(t)}
              className={`px-2 py-0.5 text-[10px] border ${prefs.followed_topics.includes(t) ? "bg-[#000080] text-white border-[#000080]" : "bg-[#c0c0c0] border-[#808080] hover:bg-[#d4d4d4]"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-[#808080] bg-white p-3 space-y-2">
        <div className="text-xs font-bold text-[#000080]">⭐ Followed Sources</div>
        <div className="flex gap-1">
          <input value={newSrc} onChange={(e) => setNewSrc(e.target.value)} placeholder="e.g. Reuters" className="flex-1 px-2 py-1 text-xs border border-[#808080]" />
          <button onClick={() => { if (newSrc.trim()) { setPrefs((p) => ({ ...p, followed_sources: [...p.followed_sources, newSrc.trim()] })); setNewSrc(""); }}}
            className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4]"><Plus size={12} /></button>
        </div>
        <div className="flex flex-wrap gap-1">
          {prefs.followed_sources.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-[10px] bg-[#000080] text-white px-1.5 py-0.5">
              {s}
              <button onClick={() => setPrefs((p) => ({ ...p, followed_sources: p.followed_sources.filter((x) => x !== s) }))}><X size={10} /></button>
            </span>
          ))}
        </div>
      </div>

      <div className="border border-[#808080] bg-white p-3 space-y-2">
        <div className="text-xs font-bold text-[#000080]">🚫 Blocked Sources</div>
        <div className="flex gap-1">
          <input value={newBlock} onChange={(e) => setNewBlock(e.target.value)} placeholder="e.g. Breitbart" className="flex-1 px-2 py-1 text-xs border border-[#808080]" />
          <button onClick={() => { if (newBlock.trim()) { setPrefs((p) => ({ ...p, blocked_sources: [...p.blocked_sources, newBlock.trim()] })); setNewBlock(""); }}}
            className="px-2 py-1 text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#d4d4d4]"><Plus size={12} /></button>
        </div>
        <div className="flex flex-wrap gap-1">
          {prefs.blocked_sources.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-[10px] bg-red-600 text-white px-1.5 py-0.5">
              {s}
              <button onClick={() => setPrefs((p) => ({ ...p, blocked_sources: p.blocked_sources.filter((x) => x !== s) }))}><X size={10} /></button>
            </span>
          ))}
        </div>
      </div>

      <div className="border border-[#808080] bg-white p-3 space-y-2">
        <div className="text-xs font-bold text-[#000080]">⚙️ Settings</div>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={prefs.hide_sponsored} onChange={(e) => setPrefs((p) => ({ ...p, hide_sponsored: e.target.checked }))} />
          Hide sponsored content
        </label>
        <label className="flex items-center gap-2 text-[11px]">
          Blindspot digest:
          <select value={prefs.digest_frequency} onChange={(e) => setPrefs((p) => ({ ...p, digest_frequency: e.target.value as Prefs["digest_frequency"] }))}
            className="text-xs border border-[#808080] bg-white px-1 py-0.5">
            <option value="off">Off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
      </div>

      <button onClick={save} className="px-3 py-1 text-xs bg-[#000080] text-white border border-[#000080] hover:bg-blue-800 flex items-center gap-1">
        <Save size={12} /> Save Preferences
      </button>
    </div>
  );
}
