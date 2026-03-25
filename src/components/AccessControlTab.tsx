import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Check, X, Copy, Clock, Mail, UserPlus, Trash2 } from "lucide-react";

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  used_at: string | null;
  expires_at: string;
  created_at: string;
  invited_by: string;
}

interface AccessRequest {
  id: string;
  email: string;
  display_name: string | null;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export function AccessControlTab() {
  const [subTab, setSubTab] = useState<"invites" | "requests">("invites");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [sending, setSending] = useState(false);

  // Request filter
  const [statusFilter, setStatusFilter] = useState("pending");

  const loadInvitations = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list_invitations" },
    });
    if (!error && data?.invitations) setInvitations(data.invitations);
  }, []);

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list_access_requests", status: statusFilter || undefined },
    });
    if (!error && data?.requests) {
      setRequests(data.requests);
      if (statusFilter === "pending") setPendingCount(data.requests.length);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadInvitations(), loadRequests()]).finally(() => setLoading(false));
  }, [loadInvitations, loadRequests]);

  // Load pending count separately
  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke("admin-users", {
        body: { action: "list_access_requests", status: "pending" },
      });
      if (data?.requests) setPendingCount(data.requests.length);
    })();
  }, []);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) { toast.error("Email required"); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "send_invite", email: inviteEmail.trim(), role: inviteRole },
      });
      if (error) throw error;

      const inviteUrl = `${window.location.origin}/auth?invite=${data.invite.token}`;
      await navigator.clipboard.writeText(inviteUrl);

      // Send invite-link email
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "invite-link",
          recipientEmail: inviteEmail.trim(),
          idempotencyKey: `invite-${data.invite.id}`,
          templateData: { inviteUrl, role: inviteRole },
        },
      });

      toast.success("Invite created, email sent & link copied to clipboard!");
      setInviteEmail("");
      loadInvitations();
    } catch (e: any) {
      toast.error(e.message || "Failed to send invite");
    }
    setSending(false);
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/auth?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied!");
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Revoke this invitation?")) return;
    const { error } = await supabase.functions.invoke("admin-users", {
      body: { action: "revoke_invite", invite_id: inviteId },
    });
    if (error) toast.error("Failed to revoke");
    else { toast.success("Invite revoked"); loadInvitations(); }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm("Remove this invitation record?")) return;
    const { error } = await supabase.functions.invoke("admin-users", {
      body: { action: "revoke_invite", invite_id: inviteId },
    });
    if (error) toast.error("Failed to remove");
    else { toast.success("Invitation removed"); loadInvitations(); }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm("Remove this access request record?")) return;
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "delete_access_request", request_id: requestId },
    });
    if (error || data?.error) toast.error(data?.error || "Failed to remove");
    else { toast.success("Request removed"); loadRequests(); }
  };

  const handleApprove = async (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    try {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "approve_access_request", request_id: requestId, role: "user" },
      });
      if (error) throw error;

      // Send access-approved email
      if (request?.email) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "access-approved",
            recipientEmail: request.email,
            idempotencyKey: `access-approved-${requestId}`,
            templateData: { displayName: request.display_name || undefined },
          },
        });
      }

      toast.success("Access granted — user account created with password reset email");
      loadRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to approve");
    }
  };

  const handleDeny = async (requestId: string) => {
    if (!confirm("Deny this access request?")) return;
    const request = requests.find(r => r.id === requestId);
    try {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "deny_access_request", request_id: requestId },
      });
      if (error) throw error;

      // Send access-denied email
      if (request?.email) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "access-denied",
            recipientEmail: request.email,
            idempotencyKey: `access-denied-${requestId}`,
            templateData: { displayName: request.display_name || undefined },
          },
        });
      }

      toast.success("Request denied");
      loadRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to deny");
    }
  };

  if (loading) return <div className="text-center py-8 text-[10px]">Loading...</div>;

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-0 mb-3">
        <button
          onClick={() => setSubTab("invites")}
          className={`win98-button text-[10px] flex items-center gap-1 ${subTab === "invites" ? "font-bold bg-white" : ""}`}
          style={subTab === "invites" ? { borderBottomColor: "white", marginBottom: "-1px", position: "relative", zIndex: 1 } : {}}
        >
          <Mail className="h-3 w-3" /> Invitations
        </button>
        <button
          onClick={() => setSubTab("requests")}
          className={`win98-button text-[10px] flex items-center gap-1 ${subTab === "requests" ? "font-bold bg-white" : ""}`}
          style={subTab === "requests" ? { borderBottomColor: "white", marginBottom: "-1px", position: "relative", zIndex: 1 } : {}}
        >
          <UserPlus className="h-3 w-3" /> Access Requests
          {pendingCount > 0 && (
            <span className="text-[8px] font-bold px-1 py-0 rounded-full" style={{ backgroundColor: "hsl(0, 70%, 50%)", color: "white" }}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {subTab === "invites" && (
        <div>
          {/* Send invite form */}
          <div className="win98-raised bg-[hsl(var(--win98-face))] p-3 mb-3">
            <p className="text-[11px] font-bold mb-2">📧 Send Invitation</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-[10px] font-bold mb-1">Email:</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="win98-input w-full"
                  placeholder="user@example.com"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1">Role:</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="win98-input">
                  <option value="user">User</option>
                  <option value="premium">Premium</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                onClick={handleSendInvite}
                disabled={sending}
                className="win98-button text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Send Invite
              </button>
            </div>
            <p className="text-[8px] text-[hsl(var(--muted-foreground))] mt-1">
              Invite link will be copied to clipboard. Expires in 7 days.
            </p>
          </div>

          {/* Invitations list */}
          <div className="win98-sunken bg-white">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                  <th className="text-left px-2 py-1 font-bold">Email</th>
                  <th className="text-left px-2 py-1 font-bold">Role</th>
                  <th className="text-left px-2 py-1 font-bold">Status</th>
                  <th className="text-left px-2 py-1 font-bold">Created</th>
                  <th className="text-right px-2 py-1 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-4 text-[hsl(var(--muted-foreground))]">No invitations sent yet</td></tr>
                )}
                {invitations.map(inv => {
                  const isUsed = !!inv.used_at;
                  const isExpired = !isUsed && new Date(inv.expires_at) < new Date();
                  const status = isUsed ? "Used" : isExpired ? "Expired" : "Pending";
                  const statusColor = isUsed ? "hsl(140, 60%, 30%)" : isExpired ? "hsl(0, 60%, 45%)" : "hsl(40, 80%, 40%)";
                  const statusBg = isUsed ? "hsl(140, 50%, 90%)" : isExpired ? "hsl(0, 50%, 92%)" : "hsl(40, 80%, 92%)";

                  return (
                    <tr key={inv.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))]">
                      <td className="px-2 py-1.5 font-bold">{inv.email}</td>
                      <td className="px-2 py-1.5">{inv.role}</td>
                      <td className="px-2 py-1.5">
                        <span className="text-[9px] font-bold px-1 py-0.5 win98-sunken" style={{ color: statusColor, backgroundColor: statusBg }}>
                          {status === "Used" && <Check className="h-2.5 w-2.5 inline mr-0.5" />}
                          {status === "Expired" && <Clock className="h-2.5 w-2.5 inline mr-0.5" />}
                          {status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {!isUsed && !isExpired && (
                            <>
                              <button onClick={() => handleCopyLink(inv.token)} className="win98-button px-1 py-0 text-[9px]" title="Copy link">
                                <Copy className="h-2.5 w-2.5" />
                              </button>
                              <button onClick={() => handleRevokeInvite(inv.id)} className="win98-button px-1 py-0 text-[9px]" title="Revoke" style={{ color: "hsl(0, 65%, 50%)" }}>
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </>
                          )}
                          {(isUsed || isExpired) && (
                            <button onClick={() => handleDeleteInvite(inv.id)} className="win98-button px-1 py-0 text-[9px]" title="Remove" style={{ color: "hsl(0, 65%, 50%)" }}>
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "requests" && (
        <div>
          {/* Filter */}
          <div className="flex gap-1 mb-3">
            {["pending", "approved", "denied", ""].map(s => (
              <button
                key={s || "all"}
                onClick={() => setStatusFilter(s)}
                className={`win98-button text-[9px] px-2 ${statusFilter === s ? "font-bold" : ""}`}
                style={statusFilter === s ? { borderStyle: "inset" } : {}}
              >
                {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Requests list */}
          <div className="win98-sunken bg-white">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                  <th className="text-left px-2 py-1 font-bold">Email</th>
                  <th className="text-left px-2 py-1 font-bold">Name</th>
                  <th className="text-left px-2 py-1 font-bold">Reason</th>
                  <th className="text-left px-2 py-1 font-bold">Status</th>
                  <th className="text-left px-2 py-1 font-bold">Submitted</th>
                  <th className="text-right px-2 py-1 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-4 text-[hsl(var(--muted-foreground))]">No access requests</td></tr>
                )}
                {requests.map(req => {
                  const statusColor =
                    req.status === "approved" ? "hsl(140, 60%, 30%)" :
                    req.status === "denied" ? "hsl(0, 60%, 45%)" :
                    "hsl(40, 80%, 40%)";
                  const statusBg =
                    req.status === "approved" ? "hsl(140, 50%, 90%)" :
                    req.status === "denied" ? "hsl(0, 50%, 92%)" :
                    "hsl(40, 80%, 92%)";

                  return (
                    <tr key={req.id} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))]">
                      <td className="px-2 py-1.5 font-bold">{req.email}</td>
                      <td className="px-2 py-1.5">{req.display_name || "—"}</td>
                      <td className="px-2 py-1.5 max-w-[200px] truncate" title={req.reason || ""}>
                        {req.reason || "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-[9px] font-bold px-1 py-0.5 win98-sunken" style={{ color: statusColor, backgroundColor: statusBg }}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-[hsl(var(--muted-foreground))]">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {req.status === "pending" && (
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => handleApprove(req.id)}
                              className="win98-button px-1 py-0 text-[9px] font-bold"
                              style={{ color: "hsl(140, 60%, 30%)" }}
                              title="Approve"
                            >
                              <Check className="h-2.5 w-2.5 inline mr-0.5" />Approve
                            </button>
                            <button
                              onClick={() => handleDeny(req.id)}
                              className="win98-button px-1 py-0 text-[9px]"
                              style={{ color: "hsl(0, 65%, 50%)" }}
                              title="Deny"
                            >
                              <X className="h-2.5 w-2.5 inline mr-0.5" />Deny
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
