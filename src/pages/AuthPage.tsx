import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Win98Window } from "@/components/Win98Window";
import { AOLDialUpAnimation } from "@/components/AOLDialUpAnimation";

const PRODUCTION_ORIGIN = "https://oppodb.com";
const getRedirectOrigin = () => {
  // Always redirect to production domain to avoid Lovable preview login gates
  if (typeof window !== "undefined" && window.location.origin === PRODUCTION_ORIGIN) {
    return PRODUCTION_ORIGIN;
  }
  return PRODUCTION_ORIGIN;
};

export default function AuthPage() {
  const [showDialUp, setShowDialUp] = useState(true);
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "request">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: string } | null>(null);

  // Check URL for invite token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (token) {
      setInviteToken(token);
      setMode("signup");
      validateInvite(token);
    }
  }, []);

  async function validateInvite(token: string) {
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "validate_invite", token },
      });
      if (error) throw error;
      if (data.valid) {
        setInviteInfo({ email: data.email, role: data.role });
        setEmail(data.email);
      } else {
        setMessage({ type: "error", text: data.error || "Invalid invite" });
      }
    } catch {
      setMessage({ type: "error", text: "Could not validate invite link" });
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message || "";
      if (msg.toLowerCase().includes("banned") || msg.toLowerCase().includes("user is banned")) {
        setMessage({ type: "error", text: "🚫 Your account has been suspended. Contact an administrator for assistance." });
      } else {
        setMessage({ type: "error", text: msg });
      }
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // If no invite token, don't allow direct signup
    if (!inviteToken) {
      setMessage({ type: "error", text: "An invitation is required to create an account. You can request access instead." });
      setLoading(false);
      return;
    }

    // Validate token again
    const { data: validation } = await supabase.functions.invoke("admin-users", {
      body: { action: "validate_invite", token: inviteToken },
    });
    if (!validation?.valid) {
      setMessage({ type: "error", text: validation?.error || "Invalid or expired invite" });
      setLoading(false);
      return;
    }

    const { data: signupData, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName }, emailRedirectTo: getRedirectOrigin() },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      // Mark invite as used
      if (signupData.user) {
        await supabase.functions.invoke("admin-users", {
          body: { action: "use_invite", token: inviteToken, user_id: signupData.user.id },
        });
        // Send welcome email
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "welcome",
            recipientEmail: email,
            idempotencyKey: `welcome-${signupData.user.id}`,
            templateData: { displayName: displayName || undefined },
          },
        });
      }
      setMessage({ type: "success", text: "Account created! Check your email for a confirmation link." });
    }
    setLoading(false);
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "submit_access_request", email, display_name: displayName, reason },
      });
      if (error) throw error;
      setMessage({ type: "success", text: data.message || "Access request submitted!" });
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Failed to submit request" });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setMessage({ type: "error", text: error.message });
    else setMessage({ type: "success", text: "Check your email for a password reset link." });
    setLoading(false);
  };

  const onSubmit =
    mode === "login" ? handleLogin :
    mode === "signup" ? handleSignup :
    mode === "request" ? handleRequestAccess :
    handleForgotPassword;

  if (showDialUp) {
    return <AOLDialUpAnimation onComplete={() => setShowDialUp(false)} />;
  }

  const titles: Record<string, string> = {
    login: "Sign In",
    signup: "Create Account",
    forgot: "Reset Password",
    request: "Request Access",
  };

  const descriptions: Record<string, string> = {
    login: "Enter your credentials to sign in",
    signup: inviteInfo ? `You've been invited as ${inviteInfo.role}` : "Create a new account with an invitation",
    forgot: "Reset your password",
    request: "Request access to the database",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(180,50%,50%)] px-4">
      <Win98Window
        title={`${titles[mode]} - Opposition Research Database`}
        icon={<span className="text-[12px]">🔐</span>}
        className="w-full max-w-[380px]"
      >
        <div className="p-4 bg-[hsl(var(--win98-face))]">
          {/* Header */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-3xl">🌐</span>
            <div>
              <h1 className="text-[13px] font-bold">Opposition Research Database</h1>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{descriptions[mode]}</p>
            </div>
          </div>

          <div className="win98-sunken bg-white p-3 mb-3">
            <form onSubmit={onSubmit} className="space-y-3">
              {(mode === "signup" || mode === "request") && (
                <div>
                  <label className="block text-[11px] font-bold mb-1">Display Name:</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="win98-input w-full"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold mb-1">Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="win98-input w-full"
                  required
                  readOnly={mode === "signup" && !!inviteInfo}
                />
              </div>

              {mode === "signup" && !inviteToken && (
                <div>
                  <label className="block text-[11px] font-bold mb-1">Invite Token:</label>
                  <input
                    type="text"
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="Paste your invite token"
                    className="win98-input w-full"
                    required
                  />
                </div>
              )}

              {mode === "request" && (
                <div>
                  <label className="block text-[11px] font-bold mb-1">Reason for Access:</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Briefly describe why you need access..."
                    className="win98-input w-full"
                    rows={3}
                    maxLength={500}
                  />
                </div>
              )}

              {mode !== "forgot" && mode !== "request" && (
                <div>
                  <label className="block text-[11px] font-bold mb-1">Password:</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="win98-input w-full"
                    required
                    minLength={6}
                  />
                </div>
              )}

              {message && (
                <div className={`text-[11px] p-2 border ${
                  message.type === "error"
                    ? "bg-[#fff0f0] border-red-400 text-red-700"
                    : "bg-[#f0fff0] border-green-400 text-green-700"
                }`}>
                  {message.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="win98-button font-bold text-[11px] px-4 disabled:opacity-50"
                >
                  {loading ? "Please wait..." :
                    mode === "login" ? "Sign In" :
                    mode === "signup" ? "Create Account" :
                    mode === "request" ? "Submit Request" :
                    "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>

          {/* Google sign-in */}
          {mode === "login" && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-[1px] bg-[hsl(var(--win98-shadow))]" />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">or</span>
                <div className="flex-1 h-[1px] bg-[hsl(var(--win98-shadow))]" />
              </div>
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setMessage(null);
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (result?.error) {
                    setMessage({ type: "error", text: result.error.message || "Google sign-in failed" });
                  }
                  setLoading(false);
                }}
                disabled={loading}
                className="win98-button w-full flex items-center justify-center gap-2 text-[11px] disabled:opacity-50"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>
            </div>
          )}

          {/* Footer links */}
          <div className="text-center text-[10px] text-[hsl(var(--muted-foreground))] space-y-1">
            {mode === "login" && (
              <>
                <button onClick={() => { setMode("forgot"); setMessage(null); }} className="underline hover:text-[hsl(var(--foreground))]">
                  Forgot password?
                </button>
                <p>
                  Have an invite?{" "}
                  <button onClick={() => { setMode("signup"); setMessage(null); }} className="underline font-bold text-[hsl(var(--primary))]">
                    Sign up
                  </button>
                </p>
                <p>
                  Need access?{" "}
                  <button onClick={() => { setMode("request"); setMessage(null); }} className="underline font-bold text-[hsl(var(--primary))]">
                    Request access
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p>
                Already have an account?{" "}
                <button onClick={() => { setMode("login"); setMessage(null); }} className="underline font-bold text-[hsl(var(--primary))]">
                  Sign in
                </button>
                {" · "}
                <button onClick={() => { setMode("request"); setMessage(null); }} className="underline text-[hsl(var(--primary))]">
                  Request access
                </button>
              </p>
            )}
            {mode === "request" && (
              <p>
                Already have an account?{" "}
                <button onClick={() => { setMode("login"); setMessage(null); }} className="underline font-bold text-[hsl(var(--primary))]">
                  Sign in
                </button>
                {" · "}
                Have an invite?{" "}
                <button onClick={() => { setMode("signup"); setMessage(null); }} className="underline text-[hsl(var(--primary))]">
                  Sign up
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <button onClick={() => { setMode("login"); setMessage(null); }} className="underline font-bold text-[hsl(var(--primary))]">
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </Win98Window>
    </div>
  );
}
