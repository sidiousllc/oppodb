import { useEffect, useState } from "react";
import { Copy, RefreshCw, Trash2, Shield, ShieldOff, Smartphone, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  type SerialKey, listMySerials, createSerial, regenerateSerial,
  revokeSerial, reactivateSerial, unbindDevice, deleteSerial, generateSerial,
} from "@/lib/serialKeys";

export function SerialKeyManager() {
  const [keys, setKeys] = useState<SerialKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [customSerial, setCustomSerial] = useState("");
  const [notes, setNotes] = useState("");

  const refresh = async () => {
    setLoading(true);
    setKeys(await listMySerials());
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success("Serial copied to clipboard");
  };

  const handleCreate = async (custom?: string) => {
    setCreating(true);
    try {
      await createSerial({ custom, notes: notes || undefined });
      toast.success(custom ? "Custom serial saved" : "New serial generated");
      setCustomSerial(""); setNotes(""); setShowAdd(false);
      await refresh();
    } catch (e: any) { toast.error(e.message ?? "Failed to create serial"); }
    finally { setCreating(false); }
  };

  const wrap = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    try { await fn(); toast.success(ok); await refresh(); }
    catch (e: any) { toast.error(e.message ?? "Action failed"); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-1">
        Serial keys unlock the Android app on first launch. Each key binds to one device after first use.
        Regenerating a key invalidates the old one and unbinds its device.
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => handleCreate()}
          disabled={creating}
          className="win98-button text-[10px] px-2 py-1 flex items-center gap-1 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Generate Random Serial
        </button>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="win98-button text-[10px] px-2 py-1 flex items-center gap-1"
        >
          <Shield className="h-3 w-3" /> {showAdd ? "Cancel" : "Set Custom Serial"}
        </button>
        <button onClick={refresh} className="win98-button text-[10px] px-2 py-1 flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {showAdd && (
        <div className="win98-sunken bg-white p-2 space-y-1.5">
          <label className="block text-[10px] font-bold">Custom serial (A–Z, 0–9, dashes; 6–128 chars)</label>
          <div className="flex gap-1">
            <input
              type="text" value={customSerial}
              onChange={(e) => setCustomSerial(e.target.value.toUpperCase())}
              placeholder="MY-CUSTOM-KEY-12345"
              className="flex-1 win98-sunken bg-white px-1.5 py-0.5 text-[10px] font-mono"
            />
            <button
              onClick={() => setCustomSerial(generateSerial())}
              className="win98-button text-[10px] px-2"
              title="Suggest a random format"
            >
              Suggest
            </button>
          </div>
          <input
            type="text" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional, e.g. 'Pixel 8')"
            className="w-full win98-sunken bg-white px-1.5 py-0.5 text-[10px]"
          />
          <button
            onClick={() => handleCreate(customSerial)}
            disabled={creating || customSerial.length < 6}
            className="win98-button text-[10px] px-2 py-1 disabled:opacity-50"
          >
            Save Custom Serial
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-[10px] text-center py-3 text-[hsl(var(--muted-foreground))]">Loading…</div>
      ) : keys.length === 0 ? (
        <div className="win98-sunken bg-white text-[10px] text-center py-3 text-[hsl(var(--muted-foreground))]">
          No serial keys yet. Generate one above to use the Android app.
        </div>
      ) : (
        <div className="space-y-1">
          {keys.map((k) => {
            const isRevoked = !!k.revoked_at;
            const isBound = !!k.device_id;
            return (
              <div key={k.id} className={`win98-sunken bg-white p-2 ${isRevoked ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <code className="text-[11px] font-mono font-bold break-all">{k.serial}</code>
                      <button onClick={() => copy(k.serial)} className="win98-button text-[9px] px-1 py-0" title="Copy">
                        <Copy className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <div className="text-[9px] text-[hsl(var(--muted-foreground))] flex items-center gap-2 flex-wrap">
                      <span className={isRevoked ? "text-red-700 font-bold" : "text-green-700 font-bold"}>
                        {isRevoked ? "REVOKED" : "ACTIVE"}
                      </span>
                      {isBound ? (
                        <span className="flex items-center gap-0.5">
                          <Smartphone className="h-2.5 w-2.5" /> bound to {k.device_id?.slice(0, 12)}…
                        </span>
                      ) : <span>· not yet bound</span>}
                      {k.validation_count > 0 && <span>· {k.validation_count} checks</span>}
                      {k.notes && <span>· {k.notes}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => wrap(k.id, () => regenerateSerial(k.id), "Serial regenerated; old one no longer works")}
                      disabled={busyId === k.id}
                      className="win98-button text-[9px] px-1.5 py-0.5 flex items-center gap-1"
                      title="Generate a new serial value (invalidates the old one and unbinds device)"
                    >
                      <RefreshCw className="h-2.5 w-2.5" /> Regenerate
                    </button>
                    {isBound && !isRevoked && (
                      <button
                        onClick={() => wrap(k.id, () => unbindDevice(k.id), "Device unbound — next launch can re-bind")}
                        disabled={busyId === k.id}
                        className="win98-button text-[9px] px-1.5 py-0.5"
                      >
                        Unbind
                      </button>
                    )}
                    {isRevoked ? (
                      <button
                        onClick={() => wrap(k.id, () => reactivateSerial(k.id), "Reactivated")}
                        disabled={busyId === k.id}
                        className="win98-button text-[9px] px-1.5 py-0.5 flex items-center gap-1"
                      >
                        <Shield className="h-2.5 w-2.5" /> Reactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => wrap(k.id, () => revokeSerial(k.id), "Serial revoked")}
                        disabled={busyId === k.id}
                        className="win98-button text-[9px] px-1.5 py-0.5 flex items-center gap-1"
                      >
                        <ShieldOff className="h-2.5 w-2.5" /> Revoke
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm("Delete this serial permanently? It cannot be recovered.")) {
                          wrap(k.id, () => deleteSerial(k.id), "Serial deleted");
                        }
                      }}
                      disabled={busyId === k.id}
                      className="win98-button text-[9px] px-1.5 py-0.5"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
