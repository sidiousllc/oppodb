// UI for managing scheduled report email delivery.
// Owners pick a cadence (daily/weekly/monthly), recipient list, and subject.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Calendar, Mail, Plus, Trash2, Loader2, Send } from "lucide-react";

interface Schedule {
  id: string;
  report_id: string;
  cadence: string;
  recipients: string[];
  subject: string;
  enabled: boolean;
  last_sent_at: string | null;
  next_run_at: string;
}

export function ReportSchedules({ reportId, reportTitle }: { reportId: string; reportTitle: string }) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    cadence: "weekly" as "daily" | "weekly" | "monthly",
    recipients: "",
    subject: `${reportTitle} — automated update`,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("report_schedules" as any)
      .select("*")
      .eq("report_id", reportId)
      .order("created_at", { ascending: false });
    setSchedules((data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [reportId]);

  const create = async () => {
    if (!user) return;
    const recipients = draft.recipients.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    if (recipients.length === 0) { toast.error("Add at least one recipient email"); return; }
    setSaving(true);
    const { error } = await supabase.from("report_schedules" as any).insert({
      report_id: reportId,
      owner_id: user.id,
      cadence: draft.cadence,
      recipients,
      subject: draft.subject,
      enabled: true,
      next_run_at: new Date(Date.now() + 60_000).toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Schedule created"); setDraft({ ...draft, recipients: "" }); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("report_schedules" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const toggle = async (id: string, enabled: boolean) => {
    await supabase.from("report_schedules" as any).update({ enabled }).eq("id", id);
    load();
  };

  const sendNow = async (id: string) => {
    setSending(id);
    const { data, error } = await supabase.functions.invoke("scheduled-report-email", {
      body: { schedule_id: id, force: true },
    });
    setSending(null);
    if (error) toast.error(error.message);
    else if ((data as any)?.error) toast.error((data as any).error);
    else { toast.success("Email queued"); load(); }
  };

  return (
    <div className="border border-border rounded p-3 bg-card space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Calendar size={14} /> Scheduled Email Delivery
      </div>

      {/* New schedule form */}
      <div className="space-y-2 p-2 border border-dashed border-border rounded">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={draft.cadence}
            onChange={(e) => setDraft({ ...draft, cadence: e.target.value as any })}
            className="text-xs border border-border bg-background rounded px-2 py-1"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            placeholder="Subject"
            className="text-xs border border-border bg-background rounded px-2 py-1"
          />
        </div>
        <textarea
          value={draft.recipients}
          onChange={(e) => setDraft({ ...draft, recipients: e.target.value })}
          placeholder="Recipients (comma- or space-separated emails)"
          rows={2}
          className="w-full text-xs border border-border bg-background rounded p-2"
        />
        <button
          onClick={create}
          disabled={saving}
          className="text-xs flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Add Schedule
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : schedules.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">No schedules yet.</div>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="border border-border rounded p-2 text-xs flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold flex items-center gap-1">
                  <Mail size={12} /> {s.cadence}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${s.enabled ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                    {s.enabled ? "active" : "paused"}
                  </span>
                </div>
                <div className="text-muted-foreground truncate" title={s.recipients.join(", ")}>
                  → {s.recipients.join(", ")}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Subject: {s.subject || "(no subject)"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Next: {new Date(s.next_run_at).toLocaleString()} · Last:{" "}
                  {s.last_sent_at ? new Date(s.last_sent_at).toLocaleString() : "never"}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => sendNow(s.id)}
                  disabled={sending === s.id}
                  className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 border border-border rounded hover:bg-accent disabled:opacity-50"
                >
                  {sending === s.id ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                  Send now
                </button>
                <button
                  onClick={() => toggle(s.id, !s.enabled)}
                  className="text-[10px] px-1.5 py-0.5 border border-border rounded hover:bg-accent"
                >
                  {s.enabled ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 border border-border rounded hover:bg-destructive/20 text-destructive"
                >
                  <Trash2 size={10} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
