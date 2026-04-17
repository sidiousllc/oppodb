import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DEVICE_ID_KEY = "ordb_device_id";
const CONSENT_KEY = "ordb_location_consent"; // values: "granted" | "denied" | null (default => auto opt-in)
const INTERVAL_MS = 15000;

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "Other";
}

export function getLocationConsent(): "granted" | "denied" {
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === "denied") return "denied";
  return "granted"; // auto opt-in by default
}

export function setLocationConsent(value: "granted" | "denied") {
  localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new Event("ordb-consent-change"));
}

export function useLocationConsent() {
  const [consent, setConsent] = useState<"granted" | "denied">(getLocationConsent());
  useEffect(() => {
    const sync = () => setConsent(getLocationConsent());
    window.addEventListener("ordb-consent-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ordb-consent-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return {
    consent,
    setConsent: (v: "granted" | "denied") => setLocationConsent(v),
  };
}

async function ensureDevice(userId: string): Promise<string | null> {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  const platform = detectPlatform();
  const browser = detectBrowser();
  const userAgent = navigator.userAgent.slice(0, 500);
  const deviceName = `${platform} · ${browser}`;

  if (deviceId) {
    // Touch last_seen
    await supabase
      .from("user_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", deviceId);
    return deviceId;
  }

  const { data, error } = await supabase
    .from("user_devices")
    .insert({
      user_id: userId,
      device_name: deviceName,
      platform,
      browser,
      user_agent: userAgent,
      consent_granted: true,
      consent_granted_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) return null;
  localStorage.setItem(DEVICE_ID_KEY, data.id);
  return data.id;
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    });
  });
}

export function LocationTrackerInit() {
  const { user } = useAuth();
  const { consent } = useLocationConsent();
  const intervalRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const recordOnce = useCallback(async (userId: string) => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const deviceId = await ensureDevice(userId);
      if (!deviceId) return;
      const pos = await getPosition();
      await supabase.from("device_locations").insert({
        device_id: deviceId,
        user_id: userId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        altitude: pos.coords.altitude ?? null,
        heading: pos.coords.heading ?? null,
        speed: pos.coords.speed ?? null,
      });
    } catch {
      // silently ignore (permission denied, offline, etc.)
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!user || consent !== "granted") return;

    recordOnce(user.id);
    intervalRef.current = window.setInterval(() => recordOnce(user.id), INTERVAL_MS);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [user, consent, recordOnce]);

  return null;
}
