import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Key, Trash2, Plus, Check, AlertCircle, Eye, EyeOff } from "lucide-react";

interface Credential {
  id: string;
  platform: string;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const PLATFORMS = [
  { id: "kalshi", name: "Kalshi", fields: [
    { key: "api_key", label: "Email", placeholder: "your@email.com" },
    { key: "api_secret", label: "Password", placeholder: "••••••••", secret: true },
  ]},
  { id: "polymarket", name: "Polymarket", fields: [
    { key: "api_key", label: "API Key / Wallet Address", placeholder: "0x..." },
    { key: "api_secret", label: "API Secret (optional)", placeholder: "Secret", secret: true },
  ]},
  { id: "predictit", name: "PredictIt", fields: [
    { key: "api_key", label: "Session Cookie", placeholder: "Paste cookie value", secret: true },
  ]},
];

export function MarketCredentialsManager() {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingPlatform, setAddingPlatform] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const fetchCredentials = async () => {
    if (!user) return;
    const { data } = await supabase.functions.invoke("market-trading", {
      body: null,
      headers: { "Content-Type": "application/json" },
    });
    // Use query param approach
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-trading?action=list-credentials`,
      {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    );
    const result = await resp.json();
    setCredentials(result.credentials || []);
    setLoading(false);
  };

  useEffect(() => { fetchCredentials(); }, [user]);

  const handleSave = async (platformId: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-trading?action=save-credentials`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            platform: platformId,
            api_key: formData.api_key || "",
            api_secret: formData.api_secret || undefined,
            passphrase: formData.passphrase || undefined,
            label: formData.label || "Default",
          }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      setMessage({ type: "success", text: `${platformId} credentials saved!` });
      setAddingPlatform(null);
      setFormData({});
      fetchCredentials();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
    setSaving(false);
  };

  const handleDelete = async (platform: string) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-trading?action=delete-credentials&platform=${platform}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
    fetchCredentials();
  };

  const connectedPlatforms = credentials.map((c) => c.platform);

  return (
    <div style={{ border: "2px inset #fff", background: "#c0c0c0", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Key size={16} />
        <span style={{ fontWeight: "bold" }}>Prediction Market API Keys</span>
      </div>

      {message && (
        <div style={{
          padding: 8, marginBottom: 8,
          background: message.type === "error" ? "#ffcccc" : "#ccffcc",
          border: "1px solid",
          borderColor: message.type === "error" ? "#ff0000" : "#00aa00",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {message.type === "error" ? <AlertCircle size={14} /> : <Check size={14} />}
          <span style={{ fontSize: 12 }}>{message.text}</span>
        </div>
      )}

      {/* Connected platforms */}
      {credentials.map((cred) => (
        <div key={cred.id} style={{
          border: "2px outset #fff", padding: 8, marginBottom: 6,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <span style={{ fontWeight: "bold" }}>
              {PLATFORMS.find((p) => p.id === cred.platform)?.name || cred.platform}
            </span>
            <span style={{ fontSize: 11, marginLeft: 8, color: "#008000" }}>● Connected</span>
            <div style={{ fontSize: 11, color: "#666" }}>
              Label: {cred.label} · Updated: {new Date(cred.updated_at).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={() => handleDelete(cred.platform)}
            style={{
              background: "#c0c0c0", border: "2px outset #fff",
              padding: "2px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <Trash2 size={12} /> Remove
          </button>
        </div>
      ))}

      {/* Add new platform */}
      {addingPlatform ? (
        <div style={{ border: "2px inset #fff", padding: 12, marginTop: 8 }}>
          <div style={{ fontWeight: "bold", marginBottom: 8 }}>
            Add {PLATFORMS.find((p) => p.id === addingPlatform)?.name} Credentials
          </div>
          {PLATFORMS.find((p) => p.id === addingPlatform)?.fields.map((field) => (
            <div key={field.key} style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, display: "block", marginBottom: 2 }}>{field.label}</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={formData[field.key] || ""}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  style={{
                    flex: 1, padding: "4px 6px", border: "2px inset #fff",
                    fontFamily: "monospace", fontSize: 12,
                  }}
                />
                {field.secret && (
                  <button
                    onClick={() => setShowSecrets({ ...showSecrets, [field.key]: !showSecrets[field.key] })}
                    style={{ background: "#c0c0c0", border: "2px outset #fff", padding: "2px 6px", cursor: "pointer" }}
                  >
                    {showSecrets[field.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              disabled={saving || !formData.api_key}
              onClick={() => handleSave(addingPlatform)}
              style={{
                background: "#c0c0c0", border: "2px outset #fff",
                padding: "4px 16px", cursor: "pointer", fontWeight: "bold",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setAddingPlatform(null); setFormData({}); }}
              style={{ background: "#c0c0c0", border: "2px outset #fff", padding: "4px 16px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PLATFORMS.filter((p) => !connectedPlatforms.includes(p.id)).map((p) => (
            <button
              key={p.id}
              onClick={() => setAddingPlatform(p.id)}
              style={{
                background: "#c0c0c0", border: "2px outset #fff",
                padding: "4px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <Plus size={12} /> {p.name}
            </button>
          ))}
          {connectedPlatforms.length === PLATFORMS.length && (
            <span style={{ fontSize: 12, color: "#666" }}>All platforms connected</span>
          )}
        </div>
      )}
    </div>
  );
}
