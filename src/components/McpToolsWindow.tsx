import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ToolSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
}

interface JsonSchemaProp {
  type?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: JsonSchemaProp;
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: ToolSchema;
}

type Mode = "builtin" | "custom";
type LogLevel = "info" | "send" | "recv" | "warn" | "error";
interface LogEntry {
  ts: number;
  level: LogLevel;
  msg: string;
}

interface StructuredError {
  message: string;
  code?: number | string;
  data?: unknown;
  status?: number;
}

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-bridge`;

interface BridgeCallResult {
  ok: boolean;
  status: number;
  result?: unknown;
  error?: StructuredError;
  raw: unknown;
  elapsedMs: number;
}

async function callBridge(
  mode: Mode,
  rpc: { method: string; params?: unknown },
  custom?: { url: string; key: string },
  log?: (level: LogLevel, msg: string) => void,
): Promise<BridgeCallResult> {
  const started = performance.now();
  const { data: sess } = await supabase.auth.getSession();
  const jwt = sess.session?.access_token;
  if (!jwt) throw new Error("Not signed in");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (mode === "custom" && custom) {
    headers["x-mcp-server-url"] = custom.url;
    if (custom.key) headers["x-mcp-server-key"] = custom.key;
  }

  log?.("send", `→ ${rpc.method} (${mode})`);

  const res = await fetch(FUNCTIONS_BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({
      mode,
      rpc: { jsonrpc: "2.0", id: Date.now(), method: rpc.method, params: rpc.params ?? {} },
    }),
  });

  const elapsedMs = Math.round(performance.now() - started);
  const json = await res.json().catch(() => ({} as Record<string, unknown>));
  log?.("recv", `← HTTP ${res.status} in ${elapsedMs}ms`);

  if (!res.ok) {
    const err: StructuredError = {
      status: res.status,
      message: typeof json.error === "string" ? json.error : `Bridge error ${res.status}`,
      data: json,
    };
    log?.("error", err.message);
    return { ok: false, status: res.status, error: err, raw: json, elapsedMs };
  }
  if (json.error) {
    const e = json.error as Record<string, unknown> | string;
    const err: StructuredError =
      typeof e === "string"
        ? { message: e, status: res.status }
        : {
            message: String(e.message ?? "Unknown error"),
            code: e.code as number | string | undefined,
            data: e.data,
            status: res.status,
          };
    log?.("error", `JSON-RPC error: ${err.message}${err.code !== undefined ? ` (code ${err.code})` : ""}`);
    return { ok: false, status: res.status, error: err, raw: json, elapsedMs };
  }
  return { ok: true, status: res.status, result: json.result ?? json, raw: json, elapsedMs };
}

function FieldInput({ name, schema, value, onChange, required }: {
  name: string;
  schema: JsonSchemaProp;
  value: unknown;
  onChange: (v: unknown) => void;
  required?: boolean;
}) {
  const t = schema.type ?? "string";
  const label = (
    <label className="block text-[10px] font-bold mb-0.5">
      {name}{required && <span className="text-red-700">*</span>}
      {schema.description && <span className="font-normal text-[hsl(var(--muted-foreground))] ml-1">— {schema.description}</span>}
    </label>
  );
  if (Array.isArray(schema.enum)) {
    return (
      <div>
        {label}
        <select
          className="win98-input text-[11px] w-full"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {schema.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
          ))}
        </select>
      </div>
    );
  }
  if (t === "boolean") {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-[10px]">{name}{required && <span className="text-red-700">*</span>}</span>
        {schema.description && <span className="text-[10px] text-[hsl(var(--muted-foreground))]">— {schema.description}</span>}
      </div>
    );
  }
  if (t === "number" || t === "integer") {
    return (
      <div>
        {label}
        <input
          type="number"
          className="win98-input text-[11px] w-full"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? undefined : Number(v));
          }}
        />
      </div>
    );
  }
  if (t === "array" || t === "object") {
    return (
      <div>
        {label}
        <textarea
          className="win98-input text-[10px] w-full font-mono"
          rows={3}
          placeholder={t === "array" ? "[]" : "{}"}
          value={value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  return (
    <div>
      {label}
      <input
        type="text"
        className="win98-input text-[11px] w-full"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </div>
  );
}

function buildFormFromSchema(schema?: ToolSchema, current: Record<string, unknown> = {}) {
  const props = schema?.properties ?? {};
  const required = schema?.required ?? [];
  return { props, required, values: current };
}

function coerceValues(props: Record<string, JsonSchemaProp>, values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === "") continue;
    const t = props[k]?.type;
    if ((t === "array" || t === "object") && typeof v === "string") {
      try { out[k] = JSON.parse(v); } catch { throw new Error(`Field "${k}" must be valid JSON`); }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function fmtTs(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour12: false }) +
    "." + String(d.getMilliseconds()).padStart(3, "0");
}

function levelClass(l: LogLevel) {
  switch (l) {
    case "send": return "text-blue-700";
    case "recv": return "text-green-700";
    case "warn": return "text-yellow-700";
    case "error": return "text-red-700";
    default: return "text-[hsl(var(--foreground))]";
  }
}

export function McpToolsWindow() {
  const [mode, setMode] = useState<Mode>("builtin");
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [tools, setTools] = useState<McpTool[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<McpTool | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StructuredError | null>(null);

  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [rawJson, setRawJson] = useState("{}");
  const [useRaw, setUseRaw] = useState(false);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState<"raw" | "logs" | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const appendLog = useCallback((level: LogLevel, msg: string) => {
    setLogs((prev) => [...prev, { ts: Date.now(), level, msg }].slice(-300));
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs.length]);

  const customCfg = useMemo(() => ({ url: customUrl.trim(), key: customKey.trim() }), [customUrl, customKey]);

  const loadTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTools([]);
    setSelected(null);
    setResult(null);
    setRawResponse(null);
    appendLog("info", `Listing tools (mode=${mode})…`);
    try {
      const r = await callBridge(
        mode,
        { method: "tools/list" },
        mode === "custom" ? customCfg : undefined,
        appendLog,
      );
      if (!r.ok) {
        setError(r.error ?? { message: "Failed to load tools" });
        return;
      }
      const result = r.result as { tools?: McpTool[] } | McpTool[];
      const list = Array.isArray(result) ? result : (result?.tools ?? []);
      setTools(list);
      appendLog("info", `Loaded ${list.length} tool${list.length === 1 ? "" : "s"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError({ message: msg });
      appendLog("error", msg);
    } finally {
      setLoading(false);
    }
  }, [mode, customCfg, appendLog]);

  useEffect(() => {
    if (mode === "builtin") void loadTools();
  }, [mode, loadTools]);

  const filteredTools = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) =>
      t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
    );
  }, [tools, filter]);

  const onSelect = (tool: McpTool) => {
    setSelected(tool);
    setResult(null);
    setRawResponse(null);
    setElapsedMs(null);
    setError(null);
    const defaults: Record<string, unknown> = {};
    for (const [k, p] of Object.entries(tool.inputSchema?.properties ?? {})) {
      if (p.default !== undefined) defaults[k] = p.default;
    }
    setFormValues(defaults);
    setRawJson(JSON.stringify(defaults, null, 2));
    setUseRaw(false);
  };

  const runTool = async () => {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    setRawResponse(null);
    setElapsedMs(null);
    setError(null);
    try {
      let args: Record<string, unknown>;
      if (useRaw) {
        try { args = JSON.parse(rawJson || "{}"); } catch { throw new Error("Invalid JSON arguments"); }
      } else {
        args = coerceValues(selected.inputSchema?.properties ?? {}, formValues);
      }
      for (const r of selected.inputSchema?.required ?? []) {
        if (args[r] === undefined || args[r] === "") {
          throw new Error(`Missing required field: ${r}`);
        }
      }
      appendLog("info", `Calling ${selected.name}`);
      const r = await callBridge(
        mode,
        { method: "tools/call", params: { name: selected.name, arguments: args } },
        mode === "custom" ? customCfg : undefined,
        appendLog,
      );
      setRawResponse(r.raw);
      setElapsedMs(r.elapsedMs);
      if (!r.ok) {
        setError(r.error ?? { message: "Tool call failed" });
      } else {
        setResult(r.result);
        appendLog("info", `Done in ${r.elapsedMs}ms`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError({ message: msg });
      appendLog("error", msg);
    } finally {
      setRunning(false);
    }
  };

  const copyRaw = async () => {
    if (rawResponse === null) return;
    try {
      await navigator.clipboard.writeText(
        typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse, null, 2),
      );
      setCopied("raw");
      setTimeout(() => setCopied(null), 1200);
    } catch {
      appendLog("error", "Clipboard copy failed");
    }
  };

  const copyLogs = async () => {
    try {
      const text = logs.map((l) => `[${fmtTs(l.ts)}] ${l.level.toUpperCase()} ${l.msg}`).join("\n");
      await navigator.clipboard.writeText(text);
      setCopied("logs");
      setTimeout(() => setCopied(null), 1200);
    } catch {
      appendLog("error", "Clipboard copy failed");
    }
  };

  const { props, required } = buildFormFromSchema(selected?.inputSchema, formValues);

  return (
    <div className="flex flex-col h-full text-[11px]">
      {/* Mode tabs */}
      <div className="flex border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
        {(["builtin", "custom"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 text-[11px] border-r border-[hsl(var(--border))] ${mode === m ? "bg-[hsl(var(--background))] font-bold" : ""}`}
          >
            {m === "builtin" ? "🌐 OppoDB MCP" : "🔌 Custom MCP server"}
          </button>
        ))}
      </div>

      {mode === "custom" && (
        <div className="p-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] space-y-1">
          <input
            type="url"
            placeholder="MCP server URL (https://...)"
            className="win98-input text-[11px] w-full"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
          />
          <div className="flex gap-1">
            <input
              type="password"
              placeholder="API key (optional)"
              className="win98-input text-[11px] flex-1"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
            />
            <button className="win98-button text-[10px] px-2" onClick={loadTools} disabled={!customUrl}>
              Connect
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Tool list */}
        <div className="w-56 border-r border-[hsl(var(--border))] flex flex-col">
          <div className="p-1 border-b border-[hsl(var(--border))]">
            <input
              type="text"
              placeholder="Filter tools…"
              className="win98-input text-[10px] w-full"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-2 text-[10px]">Loading…</div>}
            {!loading && filteredTools.length === 0 && (
              <div className="p-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                {mode === "custom" ? "Connect a server to view tools." : "No tools."}
              </div>
            )}
            {filteredTools.map((t) => (
              <button
                key={t.name}
                onClick={() => onSelect(t)}
                className={`w-full text-left px-2 py-1 text-[10px] border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] ${selected?.name === t.name ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]" : ""}`}
              >
                <div className="font-bold truncate">{t.name}</div>
                {t.description && <div className="text-[9px] truncate text-[hsl(var(--muted-foreground))]">{t.description}</div>}
              </button>
            ))}
          </div>
          <div className="p-1 border-t border-[hsl(var(--border))]">
            <button onClick={loadTools} className="win98-button text-[10px] w-full" disabled={loading}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Detail / runner */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {error && (
            <div className="border border-red-700 bg-red-50 text-red-900 p-2 text-[10px] space-y-0.5">
              <div className="font-bold">
                ⚠ Error{error.status ? ` (HTTP ${error.status})` : ""}
                {error.code !== undefined ? ` — code ${error.code}` : ""}
              </div>
              <div className="whitespace-pre-wrap break-words">{error.message}</div>
              {error.data !== undefined && error.data !== null && (
                <details>
                  <summary className="cursor-pointer">Error details</summary>
                  <pre className="mt-1 text-[9px] font-mono whitespace-pre-wrap break-words bg-white border border-red-300 p-1 max-h-48 overflow-auto">
{typeof error.data === "string" ? error.data : JSON.stringify(error.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
          {!selected && !error && (
            <div className="text-[hsl(var(--muted-foreground))] text-[10px]">
              Select a tool from the list to inspect its schema and run it.
            </div>
          )}
          {selected && (
            <>
              <div>
                <div className="font-bold">{selected.name}</div>
                {selected.description && <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{selected.description}</div>}
              </div>

              <div className="flex items-center gap-2 border-t border-b border-[hsl(var(--border))] py-1">
                <span className="text-[10px] font-bold">Input:</span>
                <label className="flex items-center gap-1 text-[10px]">
                  <input type="radio" checked={!useRaw} onChange={() => setUseRaw(false)} /> Form
                </label>
                <label className="flex items-center gap-1 text-[10px]">
                  <input type="radio" checked={useRaw} onChange={() => setUseRaw(true)} /> Raw JSON
                </label>
              </div>

              {!useRaw && (
                <div className="space-y-2">
                  {Object.keys(props).length === 0 && (
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">No inputs.</div>
                  )}
                  {Object.entries(props).map(([k, p]) => (
                    <FieldInput
                      key={k}
                      name={k}
                      schema={p}
                      required={required.includes(k)}
                      value={formValues[k]}
                      onChange={(v) => setFormValues((prev) => ({ ...prev, [k]: v }))}
                    />
                  ))}
                </div>
              )}

              {useRaw && (
                <textarea
                  className="win98-input text-[10px] w-full font-mono"
                  rows={8}
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                />
              )}

              <div className="flex gap-1">
                <button onClick={runTool} disabled={running} className="win98-button text-[11px] px-3 font-bold">
                  {running ? "Running…" : "▶ Run tool"}
                </button>
                {elapsedMs !== null && (
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] self-center ml-1">
                    {elapsedMs}ms
                  </span>
                )}
              </div>

              {result !== null && (
                <div>
                  <div className="text-[10px] font-bold mb-1">Result</div>
                  <pre className="win98-input text-[10px] font-mono whitespace-pre-wrap break-words p-2 max-h-96 overflow-auto">
{typeof result === "string" ? result : JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}

              {rawResponse !== null && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-bold">Raw response</div>
                    <button onClick={copyRaw} className="win98-button text-[9px] px-2">
                      {copied === "raw" ? "✓ Copied" : "📋 Copy raw"}
                    </button>
                  </div>
                  <pre className="win98-input text-[9px] font-mono whitespace-pre-wrap break-words p-2 max-h-64 overflow-auto">
{typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse, null, 2)}
                  </pre>
                </div>
              )}

              {/* Streaming / log console */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] font-bold">Live log ({logs.length})</div>
                  <div className="flex gap-1">
                    <button onClick={copyLogs} disabled={logs.length === 0} className="win98-button text-[9px] px-2">
                      {copied === "logs" ? "✓ Copied" : "📋 Copy"}
                    </button>
                    <button onClick={() => setLogs([])} disabled={logs.length === 0} className="win98-button text-[9px] px-2">
                      Clear
                    </button>
                  </div>
                </div>
                <div className="win98-input bg-black text-[hsl(var(--background))] p-2 font-mono text-[9px] max-h-40 overflow-auto">
                  {logs.length === 0 && (
                    <div className="text-[hsl(var(--muted-foreground))]">No activity yet.</div>
                  )}
                  {logs.map((l, i) => (
                    <div key={i} className={`whitespace-pre-wrap ${levelClass(l.level)}`}>
                      <span className="opacity-60">[{fmtTs(l.ts)}]</span>{" "}
                      <span className="font-bold">{l.level.toUpperCase()}</span>{" "}
                      {l.msg}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default McpToolsWindow;
