import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, Trash2, Webhook, Bell, Power } from "lucide-react";
import { toast } from "sonner";

type AlertRule = {
  id: string;
  name: string;
  enabled: boolean;
  entity_type: string | null;
  entity_id: string | null;
  event_types: string[];
  keywords: string[];
  channels: string[];
  trigger_count: number;
  last_triggered_at: string | null;
  webhook_endpoint_id: string | null;
  created_at: string;
};

type WebhookEndpoint = {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  created_at: string;
};

const CHANNEL_OPTIONS = ["email", "in_app", "webhook"];
const EVENT_OPTIONS = ["forecast_change", "polling_update", "news", "filing", "vote"];

export function AlertWebhooksManager() {
  const { user } = useAuth();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [hooks, setHooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showHookForm, setShowHookForm] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleEntityType, setRuleEntityType] = useState("");
  const [ruleEntityId, setRuleEntityId] = useState("");
  const [ruleEvents, setRuleEvents] = useState<string[]>(["forecast_change"]);
  const [ruleKeywords, setRuleKeywords] = useState("");
  const [ruleChannels, setRuleChannels] = useState<string[]>(["in_app"]);
  const [ruleHookId, setRuleHookId] = useState<string>("");
  const [hookLabel, setHookLabel] = useState("");
  const [hookUrl, setHookUrl] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [r, h] = await Promise.all([
      supabase.from("alert_rules").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("webhook_endpoints" as never).select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setRules((r.data as AlertRule[]) || []);
    setHooks((h.data as WebhookEndpoint[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const createRule = async () => {
    if (!user || !ruleName.trim()) { toast.error("Name required"); return; }
    const { error } = await supabase.from("alert_rules").insert({
      user_id: user.id,
      name: ruleName.trim(),
      enabled: true,
      entity_type: ruleEntityType || null,
      entity_id: ruleEntityId || null,
      event_types: ruleEvents,
      keywords: ruleKeywords.split(",").map((s) => s.trim()).filter(Boolean),
      channels: ruleChannels,
      webhook_endpoint_id: ruleHookId || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Alert rule created");
    setRuleName(""); setRuleEntityType(""); setRuleEntityId(""); setRuleKeywords(""); setRuleHookId("");
    setShowRuleForm(false);
    load();
  };

  const toggleRule = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from("alert_rules").update({ enabled: !enabled }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this alert rule?")) return;
    const { error } = await supabase.from("alert_rules").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const createHook = async () => {
    if (!user || !hookLabel.trim() || !hookUrl.trim()) { toast.error("Label and URL required"); return; }
    try { new URL(hookUrl); } catch { toast.error("Invalid URL"); return; }
    const { error } = await supabase.from("webhook_endpoints" as never).insert({
      user_id: user.id, label: hookLabel.trim(), url: hookUrl.trim(), enabled: true,
    } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Webhook added");
    setHookLabel(""); setHookUrl(""); setShowHookForm(false);
    load();
  };

  const toggleHook = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from("webhook_endpoints" as never).update({ enabled: !enabled } as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const deleteHook = async (id: string) => {
    if (!confirm("Delete this webhook endpoint?")) return;
    const { error } = await supabase.from("webhook_endpoints" as never).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-[10px]"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="space-y-3">
      {/* ── Alert Rules ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold flex items-center gap-1"><Bell className="w-3 h-3" /> Alert Rules ({rules.length})</p>
          <button onClick={() => setShowRuleForm((s) => !s)} className="win98-button text-[10px] flex items-center gap-1">
            <Plus className="w-3 h-3" /> New Rule
          </button>
        </div>

        {showRuleForm && (
          <div className="win98-sunken bg-white p-2 mb-2 space-y-1.5">
            <input className="win98-input w-full text-[10px]" placeholder="Rule name" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
            <div className="grid grid-cols-2 gap-1">
              <input className="win98-input text-[10px]" placeholder="Entity type (optional, e.g. candidate)" value={ruleEntityType} onChange={(e) => setRuleEntityType(e.target.value)} />
              <input className="win98-input text-[10px]" placeholder="Entity ID/slug (optional)" value={ruleEntityId} onChange={(e) => setRuleEntityId(e.target.value)} />
            </div>
            <input className="win98-input w-full text-[10px]" placeholder="Keywords (comma-separated)" value={ruleKeywords} onChange={(e) => setRuleKeywords(e.target.value)} />
            <div>
              <p className="text-[9px] font-bold mb-0.5">Event types:</p>
              <div className="flex flex-wrap gap-1">
                {EVENT_OPTIONS.map((e) => (
                  <label key={e} className="text-[10px] flex items-center gap-0.5">
                    <input type="checkbox" checked={ruleEvents.includes(e)} onChange={() => setRuleEvents(toggle(ruleEvents, e))} />
                    {e}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold mb-0.5">Channels:</p>
              <div className="flex gap-2">
                {CHANNEL_OPTIONS.map((c) => (
                  <label key={c} className="text-[10px] flex items-center gap-0.5">
                    <input type="checkbox" checked={ruleChannels.includes(c)} onChange={() => setRuleChannels(toggle(ruleChannels, c))} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            {ruleChannels.includes("webhook") && (
              <select className="win98-input w-full text-[10px]" value={ruleHookId} onChange={(e) => setRuleHookId(e.target.value)}>
                <option value="">— Select webhook endpoint —</option>
                {hooks.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
              </select>
            )}
            <div className="flex gap-1">
              <button onClick={createRule} className="win98-button text-[10px] font-bold">Create</button>
              <button onClick={() => setShowRuleForm(false)} className="win98-button text-[10px]">Cancel</button>
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic px-1">No alert rules yet.</p>
        ) : (
          <div className="space-y-1">
            {rules.map((r) => (
              <div key={r.id} className="win98-sunken bg-white p-1.5 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{r.name}</div>
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">
                      {r.entity_type && `${r.entity_type}${r.entity_id ? `:${r.entity_id}` : ""} • `}
                      {r.event_types.join(", ")} → {r.channels.join(", ")} • {r.trigger_count}× triggered
                    </div>
                  </div>
                  <button onClick={() => toggleRule(r.id, r.enabled)} className="win98-button text-[9px] px-1.5"
                          style={{ color: r.enabled ? "hsl(140,60%,30%)" : "hsl(0,70%,45%)" }}>
                    <Power className="w-3 h-3 inline" /> {r.enabled ? "On" : "Off"}
                  </button>
                  <button onClick={() => deleteRule(r.id)} className="win98-button text-[9px] px-1.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Webhook Endpoints ────────────────────────────────────── */}
      <div className="border-t border-[hsl(var(--win98-shadow))] pt-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold flex items-center gap-1"><Webhook className="w-3 h-3" /> Webhook Endpoints ({hooks.length})</p>
          <button onClick={() => setShowHookForm((s) => !s)} className="win98-button text-[10px] flex items-center gap-1">
            <Plus className="w-3 h-3" /> New Webhook
          </button>
        </div>

        {showHookForm && (
          <div className="win98-sunken bg-white p-2 mb-2 space-y-1.5">
            <input className="win98-input w-full text-[10px]" placeholder="Label (e.g. Slack #alerts)" value={hookLabel} onChange={(e) => setHookLabel(e.target.value)} />
            <input className="win98-input w-full text-[10px]" placeholder="https://hooks.slack.com/…" value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} />
            <div className="flex gap-1">
              <button onClick={createHook} className="win98-button text-[10px] font-bold">Add</button>
              <button onClick={() => setShowHookForm(false)} className="win98-button text-[10px]">Cancel</button>
            </div>
          </div>
        )}

        {hooks.length === 0 ? (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic px-1">No webhook endpoints configured.</p>
        ) : (
          <div className="space-y-1">
            {hooks.map((h) => (
              <div key={h.id} className="win98-sunken bg-white p-1.5 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{h.label}</div>
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate font-mono">{h.url}</div>
                  </div>
                  <button onClick={() => toggleHook(h.id, h.enabled)} className="win98-button text-[9px] px-1.5"
                          style={{ color: h.enabled ? "hsl(140,60%,30%)" : "hsl(0,70%,45%)" }}>
                    <Power className="w-3 h-3 inline" /> {h.enabled ? "On" : "Off"}
                  </button>
                  <button onClick={() => deleteHook(h.id)} className="win98-button text-[9px] px-1.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
