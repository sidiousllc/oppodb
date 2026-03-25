import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Check, X, AlertTriangle, Plug, Unplug } from "lucide-react";
import { toast } from "sonner";

interface Integration {
  id: string;
  service: string;
  slug: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

const SERVICES = [
  {
    id: "nationbuilder",
    name: "NationBuilder",
    icon: "🏛️",
    description: "Voter CRM — search people, view profiles, tags & history",
    fields: [
      { key: "slug", label: "Nation Slug", placeholder: "yourorg (from yourorg.nationbuilder.com)", required: true },
      { key: "api_key", label: "API Token", placeholder: "Your NationBuilder API token", type: "password", required: true },
    ],
    helpUrl: "https://nationbuilder.com/api_documentation",
    helpText: "Go to Settings → Developer → API Tokens in your NationBuilder admin.",
  },
  {
    id: "van",
    name: "VAN / EveryAction",
    icon: "📋",
    description: "Voter file — find people, view contact history & scores",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "applicationName|yourApiKey", type: "password", required: true },
    ],
    helpUrl: "https://docs.everyaction.com/reference/api-key",
    helpText: "Format: applicationName|apiKey. Contact your VAN admin for credentials.",
  },
  {
    id: "winred",
    name: "WinRed",
    icon: "🔴",
    description: "Fundraising — search donors, view donation history",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Your WinRed API key", type: "password", required: true },
    ],
    helpUrl: "https://winred.com",
    helpText: "Contact WinRed support or your account manager for API access.",
  },
];

export function IntegrationSettings() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    if (!user) return;
    loadIntegrations();
  }, [user]);

  async function loadIntegrations() {
    const { data } = await supabase
      .from("user_integrations" as any)
      .select("id, service, slug, display_name, is_active, created_at")
      .order("created_at");
    setIntegrations((data || []) as unknown as Integration[]);
    setLoading(false);
  }

  async function handleSave(serviceId: string) {
    if (!user) return;
    const service = SERVICES.find(s => s.id === serviceId)!;
    const data = formData[serviceId] || {};

    // Validate required fields
    for (const field of service.fields) {
      if (field.required && !data[field.key]?.trim()) {
        toast.error(`${field.label} is required`);
        return;
      }
    }

    setSaving(serviceId);
    const existing = integrations.find(i => i.service === serviceId);

    const record = {
      user_id: user.id,
      service: serviceId,
      api_key: data.api_key || "",
      slug: data.slug || "",
      display_name: service.name,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("user_integrations" as any)
        .update(record as any)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("user_integrations" as any)
        .insert(record as any));
    }

    if (error) {
      toast.error(`Failed to save: ${error.message}`);
    } else {
      toast.success(`${service.name} credentials saved`);
      await loadIntegrations();
      // Clear form
      setFormData(prev => ({ ...prev, [serviceId]: {} }));
    }
    setSaving(null);
  }

  async function handleTest(serviceId: string) {
    setTesting(serviceId);
    setTestResults(prev => ({ ...prev, [serviceId]: undefined as any }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-proxy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ service: serviceId, action: "test" }),
        }
      );

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Test failed");

      setTestResults(prev => ({ ...prev, [serviceId]: { success: true, message: data.data?.message || "Connected!" } }));
      toast.success(`${SERVICES.find(s => s.id === serviceId)!.name} connected!`);
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [serviceId]: { success: false, message: e.message } }));
      toast.error(e.message);
    }
    setTesting(null);
  }

  async function handleDisconnect(serviceId: string) {
    const existing = integrations.find(i => i.service === serviceId);
    if (!existing) return;

    const { error } = await supabase
      .from("user_integrations" as any)
      .delete()
      .eq("id", existing.id);

    if (error) {
      toast.error(`Failed to disconnect: ${error.message}`);
    } else {
      toast.success(`${SERVICES.find(s => s.id === serviceId)!.name} disconnected`);
      setTestResults(prev => {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      });
      await loadIntegrations();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-[10px]">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading integrations...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Plug className="h-4 w-4" />
        <p className="text-[11px] font-bold">🔗 Voter Data Integrations</p>
      </div>
      <p className="text-[9px] text-[hsl(var(--muted-foreground))] -mt-2 mb-2">
        Connect your campaign tools to access voter profiles directly from the Voter Data tab.
      </p>

      {SERVICES.map(service => {
        const connected = integrations.find(i => i.service === service.id);
        const isEditing = !connected || Object.keys(formData[service.id] || {}).length > 0;
        const testResult = testResults[service.id];

        return (
          <div key={service.id} className="win98-raised bg-[hsl(var(--win98-face))] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">{service.icon}</span>
                <div>
                  <span className="text-[11px] font-bold">{service.name}</span>
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))] ml-2">{service.description}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {connected && (
                  <>
                    <span className="text-[8px] px-1.5 py-0.5 font-bold rounded"
                      style={{ backgroundColor: "hsl(140, 50%, 90%)", color: "hsl(140, 60%, 30%)" }}>
                      <Check className="h-2.5 w-2.5 inline mr-0.5" />Connected
                    </span>
                    <button
                      onClick={() => handleTest(service.id)}
                      disabled={testing === service.id}
                      className="win98-button text-[8px] px-2"
                    >
                      {testing === service.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Test"}
                    </button>
                    <button
                      onClick={() => handleDisconnect(service.id)}
                      className="win98-button text-[8px] px-2"
                      style={{ color: "hsl(0, 65%, 50%)" }}
                    >
                      <Unplug className="h-2.5 w-2.5 inline mr-0.5" />Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>

            {testResult && (
              <div className={`text-[9px] p-1.5 mb-2 border rounded ${
                testResult.success
                  ? "bg-[hsl(140,50%,95%)] border-[hsl(140,50%,70%)] text-[hsl(140,60%,25%)]"
                  : "bg-[hsl(0,50%,95%)] border-[hsl(0,50%,70%)] text-[hsl(0,60%,35%)]"
              }`}>
                {testResult.success ? <Check className="h-3 w-3 inline mr-1" /> : <X className="h-3 w-3 inline mr-1" />}
                {testResult.message}
              </div>
            )}

            {(!connected || isEditing) && (
              <div className="win98-sunken bg-white p-2 space-y-2">
                {service.fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-bold mb-0.5">{field.label}:</label>
                    <input
                      type={field.type || "text"}
                      value={formData[service.id]?.[field.key] || ""}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        [service.id]: { ...(prev[service.id] || {}), [field.key]: e.target.value },
                      }))}
                      className="win98-input w-full"
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleSave(service.id)}
                    disabled={saving === service.id}
                    className="win98-button text-[10px] font-bold disabled:opacity-50"
                  >
                    {saving === service.id ? "Saving..." : connected ? "🔄 Update" : "💾 Save & Connect"}
                  </button>
                  <a href={service.helpUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] underline text-[hsl(var(--muted-foreground))]">
                    Where do I find this?
                  </a>
                </div>

                <p className="text-[8px] text-[hsl(var(--muted-foreground))]">
                  <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />
                  {service.helpText}
                </p>
              </div>
            )}
          </div>
        );
      })}

      <div className="text-[8px] text-[hsl(var(--muted-foreground))] pt-1 border-t border-[hsl(var(--border))]">
        🔒 Credentials are stored securely per-user and only used server-side for API requests. They are never exposed to other users or the browser.
      </div>
    </div>
  );
}
