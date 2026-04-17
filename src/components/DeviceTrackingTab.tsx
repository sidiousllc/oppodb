import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LocationMap, type MapPoint } from "./LocationMap";
import { toast } from "sonner";
import { Tag, RefreshCw, X } from "lucide-react";

interface DeviceRow {
  id: string;
  user_id: string;
  device_name: string | null;
  platform: string | null;
  browser: string | null;
  tags: string[] | null;
  last_seen_at: string | null;
  consent_granted: boolean | null;
}

interface LocationRow {
  id: string;
  device_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
}

export function DeviceTrackingTab() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [tagInput, setTagInput] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: devs }, { data: locs }, { data: profs }] = await Promise.all([
      supabase
        .from("user_devices")
        .select("id, user_id, device_name, platform, browser, tags, last_seen_at, consent_granted")
        .order("last_seen_at", { ascending: false }),
      supabase
        .from("device_locations")
        .select("id, device_id, user_id, latitude, longitude, accuracy, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(500),
      supabase.from("profiles").select("id, display_name"),
    ]);
    setDevices((devs || []) as DeviceRow[]);
    setLocations((locs || []) as LocationRow[]);
    const pmap: Record<string, string> = {};
    for (const p of (profs || []) as ProfileRow[]) pmap[p.id] = p.display_name || "";
    setProfiles(pmap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const platforms = useMemo(() => {
    const s = new Set<string>();
    devices.forEach(d => d.platform && s.add(d.platform));
    return Array.from(s).sort();
  }, [devices]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    devices.forEach(d => (d.tags || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [devices]);

  const filteredDevices = useMemo(() => devices.filter(d => {
    if (filterPlatform !== "all" && d.platform !== filterPlatform) return false;
    if (filterTag !== "all" && !(d.tags || []).includes(filterTag)) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${d.device_name || ""} ${d.platform || ""} ${d.browser || ""} ${profiles[d.user_id] || ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [devices, filterPlatform, filterTag, search, profiles]);

  const visibleDeviceIds = useMemo(() => new Set(filteredDevices.map(d => d.id)), [filteredDevices]);

  // Latest known location per device
  const latestByDevice = useMemo(() => {
    const m = new Map<string, LocationRow>();
    for (const l of locations) {
      if (!visibleDeviceIds.has(l.device_id)) continue;
      if (!m.has(l.device_id)) m.set(l.device_id, l);
    }
    return m;
  }, [locations, visibleDeviceIds]);

  const mapPoints: MapPoint[] = useMemo(() => {
    const out: MapPoint[] = [];
    for (const [devId, loc] of latestByDevice.entries()) {
      const dev = devices.find(d => d.id === devId);
      out.push({
        id: loc.id,
        lat: Number(loc.latitude),
        lng: Number(loc.longitude),
        label: `${profiles[loc.user_id] || "User"} · ${dev?.device_name || "Device"}`,
        recordedAt: loc.recorded_at,
      });
    }
    return out;
  }, [latestByDevice, devices, profiles]);

  const addTag = async (deviceId: string) => {
    const tag = (tagInput[deviceId] || "").trim();
    if (!tag) return;
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;
    const next = Array.from(new Set([...(dev.tags || []), tag]));
    const { error } = await supabase.from("user_devices").update({ tags: next }).eq("id", deviceId);
    if (error) { toast.error(error.message); return; }
    setTagInput(prev => ({ ...prev, [deviceId]: "" }));
    toast.success("Tag added");
    load();
  };

  const removeTag = async (deviceId: string, tag: string) => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return;
    const next = (dev.tags || []).filter(t => t !== tag);
    const { error } = await supabase.from("user_devices").update({ tags: next }).eq("id", deviceId);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (loading) return <div className="text-[10px] py-4">Loading device tracking data...</div>;

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Total Devices" value={devices.length} />
        <Stat label="Filtered" value={filteredDevices.length} />
        <Stat label="Location Pings" value={locations.length} />
        <Stat label="Mapped Now" value={mapPoints.length} />
      </div>

      {/* Filters */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 flex gap-2 flex-wrap items-end">
        <div>
          <label className="block text-[9px] font-bold mb-0.5">Search:</label>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name, platform, user..."
            className="win98-input text-[10px]"
          />
        </div>
        <div>
          <label className="block text-[9px] font-bold mb-0.5">Platform:</label>
          <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="win98-input text-[10px]">
            <option value="all">All</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-bold mb-0.5">Tag:</label>
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="win98-input text-[10px]">
            <option value="all">All</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={load} className="win98-button text-[10px] flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Map */}
      <div>
        <p className="text-[10px] font-bold mb-1">🗺️ Live Map (latest location per device, OpenStreetMap)</p>
        <LocationMap points={mapPoints} height={360} />
      </div>

      {/* Devices table */}
      <div>
        <p className="text-[10px] font-bold mb-1">Devices ({filteredDevices.length})</p>
        <div className="win98-sunken bg-white overflow-auto max-h-[400px]">
          <table className="w-full text-[10px]">
            <thead className="bg-[hsl(var(--win98-face))] sticky top-0">
              <tr className="border-b border-[hsl(var(--win98-shadow))]">
                <th className="text-left px-2 py-1">User</th>
                <th className="text-left px-2 py-1">Device</th>
                <th className="text-left px-2 py-1">Tags</th>
                <th className="text-left px-2 py-1">Last Seen</th>
                <th className="text-left px-2 py-1">Latest Location</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map(d => {
                const latest = latestByDevice.get(d.id);
                return (
                  <tr key={d.id} className="border-b border-[hsl(var(--win98-light))]">
                    <td className="px-2 py-1">
                      <div className="font-bold">{profiles[d.user_id] || "—"}</div>
                      <div className="text-[8px] font-[monospace] text-[hsl(var(--muted-foreground))]">{d.user_id.slice(0, 8)}</div>
                    </td>
                    <td className="px-2 py-1">
                      <div>{d.device_name || `${d.platform} · ${d.browser}`}</div>
                      <div className="text-[8px] text-[hsl(var(--muted-foreground))]">{d.consent_granted ? "✓ Sharing" : "🚫 Off"}</div>
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap gap-0.5 mb-0.5">
                        {(d.tags || []).map(t => (
                          <span key={t} className="win98-raised text-[8px] px-1 py-0 flex items-center gap-0.5">
                            <Tag className="h-2 w-2" />{t}
                            <button onClick={() => removeTag(d.id, t)} className="hover:text-red-600"><X className="h-2 w-2" /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-0.5">
                        <input
                          value={tagInput[d.id] || ""}
                          onChange={e => setTagInput(prev => ({ ...prev, [d.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && addTag(d.id)}
                          placeholder="add tag"
                          className="win98-input text-[9px] w-20"
                        />
                        <button onClick={() => addTag(d.id)} className="win98-button text-[9px]">+</button>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-[hsl(var(--muted-foreground))]">
                      {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "Never"}
                    </td>
                    <td className="px-2 py-1">
                      {latest ? (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${latest.latitude}&mlon=${latest.longitude}#map=16/${latest.latitude}/${latest.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[hsl(var(--primary))] underline font-[monospace] text-[9px]"
                        >
                          {Number(latest.latitude).toFixed(3)}, {Number(latest.longitude).toFixed(3)}
                        </a>
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))] italic">No pings</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredDevices.length === 0 && (
                <tr><td colSpan={5} className="text-center py-3 text-[hsl(var(--muted-foreground))] italic">No devices match filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="win98-sunken bg-white p-2">
      <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="text-[16px] font-bold">{value}</div>
    </div>
  );
}
