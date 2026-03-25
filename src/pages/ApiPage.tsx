import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { createApiKey, listApiKeys, revokeApiKey, deleteApiKey, getApiBaseUrl, type ApiKey } from "@/lib/apiKeys";
import { ApiAnalytics } from "@/components/ApiAnalytics";
import { Key, Plus, Copy, Check, Trash2, Ban, Loader2, BookOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Win98PageLayout } from "@/components/Win98PageLayout";

export default function ApiPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccessApi, loading: roleLoading } = useUserRole();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const baseUrl = getApiBaseUrl();
  const mcpUrl = baseUrl.replace("/public-api", "/mcp-server");

  const loadKeys = useCallback(async () => {
    const data = await listApiKeys();
    setKeys(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  if (roleLoading) {
    return <div className="flex items-center justify-center h-screen bg-[hsl(var(--background))]"><span className="text-[11px]">Loading...</span></div>;
  }

  if (!canAccessApi) {
    return (
      <Win98PageLayout title="API Access" icon="🔑" addressUrl="aol://ordb.research/api">
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-[11px] font-bold mb-2">Premium Access Required</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">API access is available to premium users.</p>
          <button onClick={() => navigate("/")} className="win98-button text-[10px] mt-4">← Dashboard</button>
        </div>
      </Win98PageLayout>
    );
  }

  const handleCreate = async () => {
    if (!newKeyName.trim()) { toast.error("Enter a key name"); return; }
    setCreating(true);
    const result = await createApiKey(newKeyName.trim());
    if (result) {
      setShowNewKey(result.key);
      setNewKeyName(""); setShowCreateForm(false);
      await loadKeys();
      toast.success("API key created!");
    } else { toast.error("Failed to create"); }
    setCreating(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Revoke this API key?")) return;
    if (await revokeApiKey(keyId)) { toast.success("Revoked"); loadKeys(); }
    else toast.error("Failed");
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm("Delete this key permanently?")) return;
    if (await deleteApiKey(keyId)) { toast.success("Deleted"); loadKeys(); }
    else toast.error("Failed");
  };

  const activeKeys = keys.filter(k => !k.revoked_at);
  const revokedKeys = keys.filter(k => k.revoked_at);

  return (
    <Win98PageLayout title="API Access" icon="🔑" addressUrl="aol://ordb.research/api">
      {/* New key reveal */}
      {showNewKey && (
        <div className="win98-raised bg-[#ffffcc] p-3 mb-3">
          <p className="text-[11px] font-bold mb-1">⚠️ Your new API key — copy it now!</p>
          <p className="text-[9px] text-[hsl(var(--muted-foreground))] mb-2">This won't be shown again.</p>
          <div className="flex items-center gap-1">
            <code className="win98-sunken bg-white px-2 py-1 text-[10px] font-mono flex-1 break-all">{showNewKey}</code>
            <button onClick={() => handleCopy(showNewKey)} className="win98-button text-[9px] px-2">
              {copied ? "✓" : "Copy"}
            </button>
          </div>
          <button onClick={() => setShowNewKey(null)} className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1 underline">Dismiss</button>
        </div>
      )}

      {/* Create key */}
      <div className="mb-3">
        {!showCreateForm ? (
          <button onClick={() => setShowCreateForm(true)} className="win98-button text-[10px] flex items-center gap-1 font-bold">
            <Plus className="h-3 w-3" /> Generate New API Key
          </button>
        ) : (
          <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
            <p className="text-[11px] font-bold mb-2">Create API Key</p>
            <div className="flex gap-1">
              <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name" className="win98-input flex-1" maxLength={100} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              <button onClick={handleCreate} disabled={creating} className="win98-button text-[10px] font-bold disabled:opacity-50">{creating ? "..." : "Create"}</button>
              <button onClick={() => { setShowCreateForm(false); setNewKeyName(""); }} className="win98-button text-[10px]">✕</button>
            </div>
          </div>
        )}
      </div>

      {/* Analytics */}
      <ApiAnalytics />

      {/* Active keys */}
      <div className="mb-3">
        <p className="text-[11px] font-bold mb-2">Active Keys ({activeKeys.length})</p>
        {loading ? (
          <div className="text-center py-4 text-[10px]">Loading...</div>
        ) : activeKeys.length === 0 ? (
          <div className="win98-sunken bg-white p-6 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
            🔑 No API keys yet.
          </div>
        ) : (
          <div className="space-y-1">
            {activeKeys.map(key => <KeyCard key={key.id} apiKey={key} onRevoke={handleRevoke} onDelete={handleDelete} />)}
          </div>
        )}
      </div>

      {revokedKeys.length > 0 && (
        <div className="mb-3 opacity-60">
          <p className="text-[11px] font-bold mb-2">Revoked Keys ({revokedKeys.length})</p>
          <div className="space-y-1">
            {revokedKeys.map(key => <KeyCard key={key.id} apiKey={key} onRevoke={handleRevoke} onDelete={handleDelete} />)}
          </div>
        </div>
      )}

      {/* API Documentation */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
        <p className="text-[11px] font-bold mb-2 flex items-center gap-1">📖 API Documentation</p>

        <div className="space-y-3 text-[10px]">
          <div>
            <p className="font-bold">Base URL:</p>
            <div className="flex items-center gap-1">
              <code className="win98-sunken bg-white px-2 py-0.5 font-mono text-[9px] break-all">{baseUrl}</code>
              <button onClick={() => handleCopy(baseUrl)} className="win98-button text-[8px] px-1">Copy</button>
            </div>
          </div>

          <div>
            <p className="font-bold">Auth:</p>
            <code className="win98-sunken bg-white px-2 py-0.5 font-mono text-[9px] block">curl -H "X-API-Key: YOUR_KEY" {baseUrl}/candidates</code>
          </div>

          <div>
            <p className="font-bold mb-1">Endpoints:</p>
            <div className="win98-sunken bg-white">
              {[
                { path: "/candidates", desc: "Candidate profiles" },
                { path: "/districts", desc: "Congressional districts" },
                { path: "/state-legislative", desc: "State leg districts" },
                { path: "/election-results", desc: "Election results" },
                { path: "/polling", desc: "Polling data" },
                { path: "/maga-files", desc: "MAGA files" },
                { path: "/narrative-reports", desc: "Narrative reports" },
                { path: "/local-impacts", desc: "Local impact" },
                { path: "/voter-registration-stats", desc: "Voter registration stats" },
                { path: "/search?search=query", desc: "Unified master search (supports ?categories= filter)" },
              ].map(ep => (
                <div key={ep.path} className="flex justify-between px-2 py-0.5 border-b border-[hsl(var(--win98-light))] text-[9px]">
                  <code className="font-mono font-bold">GET {ep.path}</code>
                  <span className="text-[hsl(var(--muted-foreground))]">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MCP Server */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-3">
        <p className="text-[11px] font-bold mb-2 flex items-center gap-1">🔌 MCP Server (AI Agent Access)</p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">Connect any MCP-compatible AI agent. Requires your API key.</p>
        <div className="space-y-2 text-[10px]">
          <div>
            <p className="font-bold">MCP URL:</p>
            <div className="flex items-center gap-1">
              <code className="win98-sunken bg-white px-2 py-0.5 font-mono text-[9px] break-all">{mcpUrl}</code>
              <button onClick={() => handleCopy(mcpUrl)} className="win98-button text-[8px] px-1">Copy</button>
            </div>
          </div>
          <div>
            <p className="font-bold">Claude Desktop config:</p>
            <pre className="win98-sunken bg-white px-2 py-1 font-mono text-[9px] overflow-x-auto">{`{
  "mcpServers": {
    "ordb": {
      "type": "streamable-http",
      "url": "${mcpUrl}",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}`}</pre>
          </div>
        </div>
      </div>
    </Win98PageLayout>
  );
}

function KeyCard({ apiKey, onRevoke, onDelete }: { apiKey: ApiKey; onRevoke: (id: string) => void; onDelete: (id: string) => void; }) {
  const isRevoked = !!apiKey.revoked_at;
  return (
    <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 flex items-center justify-between gap-2">
      <div className="min-w-0 text-[10px]">
        <div className="flex items-center gap-1 mb-0.5">
          <span>🔑</span>
          <span className="font-bold">{apiKey.name}</span>
          {isRevoked && <span className="text-[8px] text-red-600 font-bold">[REVOKED]</span>}
        </div>
        <div className="flex items-center gap-2 text-[9px] text-[hsl(var(--muted-foreground))]">
          <code className="font-mono">{apiKey.key_prefix}</code>
          <span>Created {new Date(apiKey.created_at).toLocaleDateString()}</span>
          <span>{apiKey.request_count} req</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {!isRevoked && (
          <button onClick={() => onRevoke(apiKey.id)} className="win98-button px-1 py-0 text-[9px]" title="Revoke"><Ban className="h-2.5 w-2.5" /></button>
        )}
        <button onClick={() => onDelete(apiKey.id)} className="win98-button px-1 py-0 text-[9px]" title="Delete"><Trash2 className="h-2.5 w-2.5" /></button>
      </div>
    </div>
  );
}
