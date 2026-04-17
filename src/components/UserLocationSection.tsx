import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LocationMap, type MapPoint } from "./LocationMap";

interface UserLocationSectionProps {
  userId: string;
  /** Kept for back-compat; ignored — we now fetch ALL points via pagination. */
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

const PAGE_SIZE = 1000;

export function UserLocationSection({ userId }: UserLocationSectionProps) {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Devices for this user
      const devsQ = supabase
        .from("user_devices")
        .select("id, device_name, platform, browser, tags, last_seen_at")
        .eq("user_id", userId)
        .order("last_seen_at", { ascending: false });

      // Paginated fetch of ALL location pings for this user
      const allLocs: LocationRow[] = [];
      let offset = 0;
      while (!cancelled) {
        const { data, error } = await supabase
          .from("device_locations")
          .select("id, device_id, latitude, longitude, accuracy, recorded_at")
          .eq("user_id", userId)
          .order("recorded_at", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        allLocs.push(...(data as LocationRow[]));
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      const { data: devs } = await devsQ;
      if (cancelled) return;
      setDevices((devs || []) as DeviceRow[]);
      setLocations(allLocs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Default the date range to the full span the first time data loads
  useEffect(() => {
    if (locations.length === 0) return;
    if (!dateFrom) setDateFrom(locations[0].recorded_at.slice(0, 10));
    if (!dateTo) setDateTo(locations[locations.length - 1].recorded_at.slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  const filteredLocs = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : -Infinity;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : Infinity;
    return locations.filter(l => {
      if (selectedDevice !== "all" && l.device_id !== selectedDevice) return false;
      const t = new Date(l.recorded_at).getTime();
      return t >= fromTs && t <= toTs;
    });
  }, [locations, selectedDevice, dateFrom, dateTo]);

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

  const minDay = locations[0]?.recorded_at.slice(0, 10);
  const maxDay = locations[locations.length - 1]?.recorded_at.slice(0, 10);

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] font-bold mb-1">Devices ({devices.length}):</p>
        <div className="space-y-0.5 mb-2 flex flex-wrap gap-0.5">
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

      {/* Date range filter */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-1 flex flex-wrap gap-2 items-end text-[9px]">
        <div>
          <label className="block font-bold mb-0.5">From:</label>
          <input
            type="date"
            value={dateFrom}
            min={minDay}
            max={maxDay}
            onChange={e => setDateFrom(e.target.value)}
            className="win98-input text-[9px]"
          />
        </div>
        <div>
          <label className="block font-bold mb-0.5">To:</label>
          <input
            type="date"
            value={dateTo}
            min={minDay}
            max={maxDay}
            onChange={e => setDateTo(e.target.value)}
            className="win98-input text-[9px]"
          />
        </div>
        <button
          onClick={() => { setDateFrom(minDay || ""); setDateTo(maxDay || ""); }}
          className="win98-button text-[9px]"
        >
          Reset range
        </button>
        <span className="ml-auto font-[monospace]">
          Showing {filteredLocs.length} of {locations.length} pings
        </span>
      </div>

      {mapPoints.length === 0 ? (
        <div className="text-[10px] text-[hsl(var(--muted-foreground))] italic py-3">
          No location pings in this range.
        </div>
      ) : (
        <>
          <LocationMap
            points={mapPoints}
            height={320}
            showPath
            colorByDate
            animateTrail
          />
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
                {filteredLocs.slice(-100).reverse().map(l => (
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
