import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Check, X, KeyRound, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { OSINT_TOOLS } from "@/data/osintTools";

/**
 * OSINT API Keys tab for ProfilePage. Reuses the existing credential-vault
 * edge function + user_integrations table so values are stored AES-256-GCM
 * encrypted server-side. Each tool with `apiKey` config gets a row here.
 */

interface Integration {
  id: string;
  service: string;
  is_active: boolean;
}

const KEY_TOOLS = OSINT_TOOLS.filter((t) => !!t.apiKey);

export function OSINTApiKeysTab() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    const { data } = await supabase
      .from("user_integrations" as any)
      .select("id, service, is_active")
      .order("created_at");
    setIntegrations((data || []) as unknown as Integration[]);
    setLoading(false);
  }

  async function save(service: string, label: string) {
    const value = drafts[service]?.trim();
    if (!value) { toast.error(`${label} cannot be empty`); return; }
    setSaving(service);
    try {
      const existing = integrations.find((i) => i.service === service);
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("credential-vault", {
        body: {
          action: "save",
          service,
          api_key: value,
          display_name: label,
          integration_id: existing?.id,
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw error;
      toast.success(`${label} saved (encrypted)`);
      setDrafts((d) => { const n = { ...d }; delete n[service]; return n; });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function disconnect(id: string, service: string, label: string) {
    if (!confirm(`Remove ${label}?`)) return;
    const { error } = await supabase.from("user_integrations" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`${label} removed`); load(); }
  }

  if (loading) return <div className="text-[11px] p-4">Loading…</div>;

  return (
    <div className="space-y-2">
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1.5 text-[10px]">
        <div className="flex items-start gap-2">
          <KeyRound className="h-3 w-3 shrink-0 mt-0.5" />
          <div>
            <strong>OSINT Tool API Keys.</strong> Keys are AES-256-GCM encrypted before storage and only ever decrypted server-side when running a search. Most providers offer a free tier — see help link per row.
          </div>
        </div>
      </div>

      {KEY_TOOLS.map((tool) => {
        const conn = integrations.find((i) => i.service === tool.apiKey!.service);
        const draft = drafts[tool.apiKey!.service] ?? "";
        const isSaving = saving === tool.apiKey!.service;
        return (
          <div key={tool.id} className="win98-raised bg-[hsl(var(--win98-face))] p-2">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <span className="text-base shrink-0">{tool.emoji}</span>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold flex items-center gap-1">
                    {tool.label}
                    {conn && <Check className="h-3 w-3 text-green-700" />}
                    {tool.apiKey!.free && <span className="text-[8px] px-1 bg-green-100 border border-green-400 text-green-800">FREE TIER</span>}
                  </div>
                  <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{tool.apiKey!.helpText}</div>
                </div>
              </div>
              <a
                href={tool.apiKey!.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="win98-button text-[9px] inline-flex items-center gap-1 shrink-0"
              >
                Get key <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <div className="flex gap-1">
              <input
                type="password"
                value={draft}
                onChange={(e) => setDrafts((d) => ({ ...d, [tool.apiKey!.service]: e.target.value }))}
                placeholder={conn ? "•••••••• (saved — enter to replace)" : tool.apiKey!.label}
                className="win98-input flex-1 text-[10px]"
              />
              <button
                onClick={() => save(tool.apiKey!.service, tool.apiKey!.label)}
                disabled={isSaving || !draft.trim()}
                className="win98-button text-[10px] disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Save"}
              </button>
              {conn && (
                <button
                  onClick={() => disconnect(conn.id, tool.apiKey!.service, tool.label)}
                  className="win98-button text-[10px]"
                  title="Remove saved key"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
