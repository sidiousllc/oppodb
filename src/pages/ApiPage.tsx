import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { createApiKey, listApiKeys, revokeApiKey, deleteApiKey, getApiBaseUrl, type ApiKey } from "@/lib/apiKeys";
import { ApiAnalytics } from "@/components/ApiAnalytics";
import {
  ArrowLeft, Key, Plus, Copy, Check, Trash2, Ban, Eye, EyeOff,
  Loader2, Code, ExternalLink, BookOpen, Shield,
} from "lucide-react";
import { toast } from "sonner";

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

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccessApi) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <Shield className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">Premium Access Required</h1>
        <p className="text-muted-foreground text-center max-w-md">
          API and MCP server access is available to premium users. Contact an administrator to upgrade your account.
        </p>
        <button onClick={() => navigate("/")} className="text-primary hover:underline text-sm">
          ← Back to Dashboard
        </button>
      </div>
    );
  }
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

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for your API key");
      return;
    }
    setCreating(true);
    const result = await createApiKey(newKeyName.trim());
    if (result) {
      setShowNewKey(result.key);
      setNewKeyName("");
      setShowCreateForm(false);
      await loadKeys();
      toast.success("API key created! Copy it now — it won't be shown again.");
    } else {
      toast.error("Failed to create API key");
    }
    setCreating(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Revoke this API key? It will immediately stop working.")) return;
    const ok = await revokeApiKey(keyId);
    if (ok) {
      toast.success("API key revoked");
      loadKeys();
    } else {
      toast.error("Failed to revoke key");
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm("Permanently delete this API key?")) return;
    const ok = await deleteApiKey(keyId);
    if (ok) {
      toast.success("API key deleted");
      loadKeys();
    } else {
      toast.error("Failed to delete key");
    }
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">API Access</h1>
            <p className="text-sm text-muted-foreground">
              Generate API keys to access ORDB data programmatically
            </p>
          </div>
        </div>

        {/* New key reveal */}
        {showNewKey && (
          <div className="mb-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <Key className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-1">
                  Your new API key — copy it now!
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  This key will not be shown again. Store it securely.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm font-mono text-foreground break-all">
                    {showNewKey}
                  </code>
                  <button
                    onClick={() => handleCopy(showNewKey)}
                    className="shrink-0 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowNewKey(null)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Create key */}
        <div className="mb-8">
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Generate New API Key
            </button>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Create API Key</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g. My App, Research Script)"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  maxLength={100}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4" />
                  )}
                  Create
                </button>
                <button
                  onClick={() => { setShowCreateForm(false); setNewKeyName(""); }}
                  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Usage Analytics */}
        <ApiAnalytics />

        {/* Active keys */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Active Keys ({activeKeys.length})
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeKeys.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No API keys yet. Generate one to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeKeys.map((key) => (
                <KeyCard
                  key={key.id}
                  apiKey={key}
                  onRevoke={handleRevoke}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Revoked keys */}
        {revokedKeys.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-muted-foreground mb-3">
              Revoked Keys ({revokedKeys.length})
            </h2>
            <div className="space-y-3 opacity-60">
              {revokedKeys.map((key) => (
                <KeyCard
                  key={key.id}
                  apiKey={key}
                  onRevoke={handleRevoke}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}

        {/* API Documentation */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">API Documentation</h2>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Base URL</h3>
              <div className="flex items-center gap-2">
                <code className="rounded-lg bg-muted px-3 py-1.5 text-sm font-mono text-foreground break-all">
                  {baseUrl}
                </code>
                <button
                  onClick={() => handleCopy(baseUrl)}
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Authentication</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Include your API key via header or query parameter:
              </p>
              <div className="space-y-2">
                <CodeBlock
                  label="Header (recommended)"
                  code={`curl -H "X-API-Key: YOUR_KEY" ${baseUrl}/candidates`}
                  onCopy={handleCopy}
                />
                <CodeBlock
                  label="Query parameter"
                  code={`${baseUrl}/candidates?apikey=YOUR_KEY`}
                  onCopy={handleCopy}
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Endpoints</h3>
              <div className="grid gap-2">
                {[
                  { path: "/candidates", desc: "Candidate profiles with research content", params: "search" },
                  { path: "/districts", desc: "Congressional district demographics", params: "state, search" },
                  { path: "/state-legislative", desc: "State legislative district profiles", params: "state, chamber" },
                  { path: "/election-results", desc: "State legislative election results", params: "state, chamber, year" },
                  { path: "/polling", desc: "Polling data & approval ratings", params: "search" },
                  { path: "/maga-files", desc: "MAGA research files", params: "search" },
                  { path: "/narrative-reports", desc: "Narrative research reports", params: "search" },
                  { path: "/local-impacts", desc: "Local impact analyses by state", params: "state, search" },
                ].map((ep) => (
                  <div
                    key={ep.path}
                    className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <div>
                      <code className="text-sm font-mono font-medium text-foreground">
                        GET {ep.path}
                      </code>
                      <p className="text-xs text-muted-foreground">{ep.desc}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {ep.params}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Pagination</h3>
              <p className="text-sm text-muted-foreground">
                Use <code className="text-xs bg-muted px-1 rounded">limit</code> (max 1000) and{" "}
                <code className="text-xs bg-muted px-1 rounded">offset</code> query params.
                Response includes <code className="text-xs bg-muted px-1 rounded">meta.total</code> for total count.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Example: Python</h3>
              <CodeBlock
                label=""
                code={`import requests

API_KEY = "ordb_xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx"
BASE = "${baseUrl}"

# Get all candidates
r = requests.get(f"{BASE}/candidates", headers={"X-API-Key": API_KEY})
data = r.json()
print(f"Found {data['meta']['total']} candidates")

# Get CA state legislative districts
r = requests.get(f"{BASE}/state-legislative?state=CA", headers={"X-API-Key": API_KEY})
districts = r.json()["data"]`}
                onCopy={handleCopy}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Example: JavaScript</h3>
              <CodeBlock
                label=""
                code={`const API_KEY = "ordb_xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx";
const BASE = "${baseUrl}";

const res = await fetch(\`\${BASE}/candidates?search=smith\`, {
  headers: { "X-API-Key": API_KEY }
});
const { data, meta } = await res.json();
console.log(\`\${meta.total} results\`, data);`}
                onCopy={handleCopy}
              />
            </div>
          </div>
        </div>

        {/* MCP Server Documentation */}
        <div className="rounded-xl border border-border bg-card p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <ExternalLink className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">MCP Server (AI Agent Access)</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Connect any MCP-compatible AI agent (Claude, Cursor, Windsurf, etc.) to access ORDB data directly.
            No API key required — the MCP server is open for public read access.
          </p>

          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">MCP Server URL</h3>
              <div className="flex items-center gap-2">
                <code className="rounded-lg bg-muted px-3 py-1.5 text-sm font-mono text-foreground break-all">
                  {mcpUrl}
                </code>
                <button
                  onClick={() => handleCopy(mcpUrl)}
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Protocol</h3>
              <p className="text-sm text-muted-foreground">
                MCP Streamable HTTP — send JSON-RPC POST requests with{" "}
                <code className="text-xs bg-muted px-1 rounded">Accept: application/json, text/event-stream</code>
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Available Tools (10)</h3>
              <div className="grid gap-2">
                {[
                  { name: "search_candidates", desc: "Search opposition research candidate profiles by name" },
                  { name: "get_candidate", desc: "Get full candidate profile by slug" },
                  { name: "search_congressional_districts", desc: "Search congressional district demographics" },
                  { name: "search_state_legislative", desc: "Search ~9,300 state house/senate district profiles" },
                  { name: "get_election_results", desc: "Get election results with vote counts and winners" },
                  { name: "get_polling_data", desc: "Get polling data with approval/favorability ratings" },
                  { name: "get_maga_files", desc: "Get vetting reports on Trump admin appointees" },
                  { name: "get_narrative_reports", desc: "Get issue-based policy impact reports" },
                  { name: "get_local_impacts", desc: "Get state-specific policy impact analyses" },
                ].map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <code className="text-sm font-mono font-medium text-foreground whitespace-nowrap">
                      {tool.name}
                    </code>
                    <p className="text-xs text-muted-foreground">{tool.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Claude Desktop Configuration</h3>
              <CodeBlock
                label="Add to claude_desktop_config.json"
                code={`{
  "mcpServers": {
    "ordb": {
      "type": "streamable-http",
      "url": "${mcpUrl}"
    }
  }
}`}
                onCopy={handleCopy}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Test with MCP Inspector</h3>
              <CodeBlock
                label=""
                code={`npx @modelcontextprotocol/inspector ${mcpUrl}`}
                onCopy={handleCopy}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyCard({
  apiKey,
  onRevoke,
  onDelete,
}: {
  apiKey: ApiKey;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isRevoked = !!apiKey.revoked_at;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Key className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{apiKey.name}</span>
          {isRevoked && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              Revoked
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <code className="font-mono">{apiKey.key_prefix}</code>
          <span>•</span>
          <span>Created {new Date(apiKey.created_at).toLocaleDateString()}</span>
          {apiKey.last_used_at && (
            <>
              <span>•</span>
              <span>Last used {new Date(apiKey.last_used_at).toLocaleDateString()}</span>
            </>
          )}
          <span>•</span>
          <span>{apiKey.request_count.toLocaleString()} requests</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!isRevoked && (
          <button
            onClick={() => onRevoke(apiKey.id)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Revoke key"
          >
            <Ban className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(apiKey.id)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
          title="Delete key"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CodeBlock({
  label,
  code,
  onCopy,
}: {
  label: string;
  code: string;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="relative">
      {label && (
        <span className="text-xs text-muted-foreground mb-1 block">{label}</span>
      )}
      <div className="relative group">
        <pre className="rounded-lg bg-muted px-3 py-2 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all">
          {code}
        </pre>
        <button
          onClick={() => onCopy(code)}
          className="absolute top-2 right-2 p-1 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
