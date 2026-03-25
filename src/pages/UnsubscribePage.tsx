import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already_unsubscribed" | "invalid" | "success" | "error";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already_unsubscribed");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) {
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already_unsubscribed");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#008080", fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif" }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "90vw",
          border: "2px solid #808080",
          boxShadow: "2px 2px 0 #000",
          background: "#c0c0c0",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: "linear-gradient(90deg, #000080, #1084d0)",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>
            ✉️ Email Preferences
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px" }}>
          {status === "loading" && (
            <p style={{ fontSize: 12, color: "#333" }}>Validating your request...</p>
          )}

          {status === "valid" && (
            <>
              <p style={{ fontSize: 13, color: "#333", marginBottom: 16 }}>
                Are you sure you want to unsubscribe from <strong>ordb</strong> app emails?
              </p>
              <p style={{ fontSize: 11, color: "#666", marginBottom: 20 }}>
                You will stop receiving notification emails. This does not affect authentication emails (password reset, etc.).
              </p>
              <button
                onClick={handleConfirm}
                disabled={processing}
                style={{
                  background: "#1a47a6",
                  color: "#fff",
                  border: "none",
                  padding: "8px 20px",
                  fontSize: 12,
                  fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif",
                  cursor: processing ? "wait" : "pointer",
                }}
              >
                {processing ? "Processing..." : "Confirm Unsubscribe"}
              </button>
            </>
          )}

          {status === "success" && (
            <>
              <p style={{ fontSize: 14, color: "#1a47a6", fontWeight: "bold", marginBottom: 8 }}>
                ✅ Unsubscribed successfully
              </p>
              <p style={{ fontSize: 12, color: "#333" }}>
                You will no longer receive app emails from ordb.
              </p>
            </>
          )}

          {status === "already_unsubscribed" && (
            <>
              <p style={{ fontSize: 14, color: "#1a47a6", fontWeight: "bold", marginBottom: 8 }}>
                ℹ️ Already unsubscribed
              </p>
              <p style={{ fontSize: 12, color: "#333" }}>
                This email address has already been unsubscribed.
              </p>
            </>
          )}

          {status === "invalid" && (
            <>
              <p style={{ fontSize: 14, color: "#c00", fontWeight: "bold", marginBottom: 8 }}>
                ❌ Invalid or expired link
              </p>
              <p style={{ fontSize: 12, color: "#333" }}>
                This unsubscribe link is not valid. It may have expired or already been used.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <p style={{ fontSize: 14, color: "#c00", fontWeight: "bold", marginBottom: 8 }}>
                ⚠️ Something went wrong
              </p>
              <p style={{ fontSize: 12, color: "#333" }}>
                We couldn't process your request. Please try again later.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
