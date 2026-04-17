import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LocationMap, type MapPoint } from "./LocationMap";

interface UserLocationSectionProps {
  userId: string;
  limit?: number;
}

interface DeviceRow {
  id: string;
  device_name: string | null;
  platform: string | null;
  browser: string | null;
  tags: string[] | null;
  last_seen_at: string | null;
}

interface LocationRow {
  id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
}

export function UserLocationSection({ userId, limit = 200 }: UserLocationSectionProps) {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: devs }, { data: locs }] = await Promise.all([
        supabase
          .from("user_devices")
          .select("id, device_name, platform, browser, tags, last_seen_at")
          .eq("user_id", userId)
          .order("last_seen_at", { ascending: false }),
        supabase
          .from("device_locations")
          .select("id, device_id, latitude, longitude, accuracy, recorded_at")
          .eq("user_id", userId)
          .order("recorded_at", { ascending: false })
          .limit(limit),
      ]);
      if (cancelled) return;
      setDevices((devs || []) as DeviceRow[]);
      setLocations((locs || []) as LocationRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, limit]);

  const filteredLocs = useMemo(
    () => selectedDevice === "all" ? locations : locations.filter(l => l.device_id === selectedDevice),
    [locations, selectedDevice]
  );

  const mapPoints: MapPoint[] = useMemo(() => filteredLocs.map(l => ({
    id: l.id,
    lat: Number(l.latitude),
    lng: Number(l.longitude),
    label: devices.find(d => d.id === l.device_id)?.device_name || "Device",
    recordedAt: l.recorded_at,
  })), [filteredLocs, devices]);

  if (loading) return <div className="text-[10px] py-2">Loading location data...</div>;

  if (devices.length === 0) {
    return (
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] italic py-3">
        No devices registered. User has not enabled location sharing.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] font-bold mb-1">Devices ({devices.length}):</p>
        <div className="space-y-0.5 mb-2">
          <button
            onClick={() => setSelectedDevice("all")}
            className={`win98-button text-[9px] mr-1 ${selectedDevice === "all" ? "font-bold" : ""}`}
            style={selectedDevice === "all" ? { borderStyle: "inset" } : {}}
          >
            All ({locations.length})
          </button>
          {devices.map(d => {
            const count = locations.filter(l => l.device_id === d.id).length;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDevice(d.id)}
                className={`win98-button text-[9px] mr-1 ${selectedDevice === d.id ? "font-bold" : ""}`}
                style={selectedDevice === d.id ? { borderStyle: "inset" } : {}}
                title={d.device_name || ""}
              >
                {d.platform || "?"} · {d.browser || "?"} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {mapPoints.length === 0 ? (
        <div className="text-[10px] text-[hsl(var(--muted-foreground))] italic py-3">
          No location pings recorded yet.
        </div>
      ) : (
        <>
          <LocationMap points={mapPoints} height={260} showPath />
          <div className="win98-sunken bg-white max-h-[140px] overflow-auto">
            <table className="w-full text-[9px]">
              <thead className="bg-[hsl(var(--win98-face))] sticky top-0">
                <tr>
                  <th className="text-left px-1 py-0.5">When</th>
                  <th className="text-left px-1 py-0.5">Lat, Lng</th>
                  <th className="text-left px-1 py-0.5">Accuracy</th>
                  <th className="text-left px-1 py-0.5">Map</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocs.slice(0, 50).map(l => (
                  <tr key={l.id} className="border-b border-[hsl(var(--win98-light))]">
                    <td className="px-1 py-0.5">{new Date(l.recorded_at).toLocaleString()}</td>
                    <td className="px-1 py-0.5 font-[monospace]">{Number(l.latitude).toFixed(4)}, {Number(l.longitude).toFixed(4)}</td>
                    <td className="px-1 py-0.5">{l.accuracy ? `±${Math.round(l.accuracy)}m` : "—"}</td>
                    <td className="px-1 py-0.5">
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${l.latitude}&mlon=${l.longitude}#map=16/${l.latitude}/${l.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[hsl(var(--primary))] underline"
                      >
                        OSM
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
