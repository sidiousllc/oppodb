import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Play, Pause, SkipBack } from "lucide-react";

// Fix default marker icon paths (Vite bundling issue with leaflet)
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  recordedAt?: string;
  color?: string;
}

interface LocationMapProps {
  points: MapPoint[];
  height?: number | string;
  showPath?: boolean;
  /** Color polylines/points by date and show a date legend */
  colorByDate?: boolean;
  /** Show animated trail playback controls (requires recordedAt on points) */
  animateTrail?: boolean;
}

// Distinct, accessible color palette for date-based segments
const DATE_PALETTE = [
  "hsl(220, 90%, 55%)", "hsl(0, 75%, 55%)", "hsl(140, 65%, 42%)",
  "hsl(35, 95%, 50%)", "hsl(280, 70%, 55%)", "hsl(190, 85%, 45%)",
  "hsl(330, 75%, 55%)", "hsl(60, 85%, 45%)", "hsl(15, 80%, 50%)",
  "hsl(170, 70%, 40%)", "hsl(250, 70%, 60%)", "hsl(95, 60%, 45%)",
];

function dayKey(iso?: string): string {
  if (!iso) return "unknown";
  return iso.slice(0, 10);
}

export function LocationMap({
  points,
  height = 320,
  showPath = false,
  colorByDate = false,
  animateTrail = false,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const animLayerRef = useRef<L.LayerGroup | null>(null);
  const animTimerRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [animIndex, setAnimIndex] = useState(0);

  // Sort points chronologically (oldest → newest) for path/animation correctness
  const sortedPoints = useMemo(() => {
    const withTime = points.map((p, i) => ({ p, t: p.recordedAt ? new Date(p.recordedAt).getTime() : i }));
    withTime.sort((a, b) => a.t - b.t);
    return withTime.map(x => x.p);
  }, [points]);

  // Group points by day → assign palette color
  const dateColorMap = useMemo(() => {
    const days = Array.from(new Set(sortedPoints.map(p => dayKey(p.recordedAt))));
    const m = new Map<string, string>();
    days.forEach((d, i) => m.set(d, DATE_PALETTE[i % DATE_PALETTE.length]));
    return m;
  }, [sortedPoints]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [39.8283, -98.5795],
      zoom: 4,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    animLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    const timers = [50, 150, 400, 1000, 2000].map(ms =>
      setTimeout(() => { try { map.invalidateSize(); } catch {} }, ms)
    );

    const onVis = () => { try { map.invalidateSize(); } catch {} };
    window.addEventListener("resize", onVis);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", onVis);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      if (animTimerRef.current) window.clearInterval(animTimerRef.current);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      animLayerRef.current = null;
    };
  }, []);

  // Render markers + polylines
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (sortedPoints.length === 0) return;

    const latlngs: L.LatLngExpression[] = [];
    for (const p of sortedPoints) {
      const ll: L.LatLngExpression = [p.lat, p.lng];
      latlngs.push(ll);
      const color = colorByDate
        ? (dateColorMap.get(dayKey(p.recordedAt)) || "hsl(220, 90%, 55%)")
        : (p.color || "hsl(220, 90%, 55%)");

      const marker = L.circleMarker(ll, {
        radius: 5,
        fillColor: color,
        color: "#fff",
        weight: 1.2,
        fillOpacity: 0.9,
      });
      marker.bindPopup(`
        <div style="font-size:11px;">
          <strong>${p.label || "Location"}</strong><br/>
          ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}<br/>
          ${p.recordedAt ? new Date(p.recordedAt).toLocaleString() : ""}
        </div>
      `);
      marker.addTo(layer);
    }

    if (showPath && latlngs.length > 1) {
      if (colorByDate) {
        // Draw a separate polyline segment per consecutive same-day run
        let segStart = 0;
        let curDay = dayKey(sortedPoints[0].recordedAt);
        for (let i = 1; i <= sortedPoints.length; i++) {
          const d = i < sortedPoints.length ? dayKey(sortedPoints[i].recordedAt) : null;
          if (d !== curDay) {
            const seg = latlngs.slice(segStart, i);
            if (seg.length > 1) {
              L.polyline(seg, {
                color: dateColorMap.get(curDay) || "hsl(220,90%,55%)",
                weight: 3,
                opacity: 0.75,
              }).addTo(layer);
            }
            // Add a faint connector across day boundaries to keep the trail continuous
            if (i < sortedPoints.length) {
              L.polyline([latlngs[i - 1], latlngs[i]], {
                color: "hsl(0,0%,55%)",
                weight: 1,
                opacity: 0.35,
                dashArray: "3,4",
              }).addTo(layer);
            }
            segStart = i;
            if (d) curDay = d;
          }
        }
      } else {
        L.polyline(latlngs, { color: "hsl(220, 90%, 55%)", weight: 2, opacity: 0.6 }).addTo(layer);
      }
    }

    if (latlngs.length === 1) {
      map.setView(latlngs[0], 13);
    } else {
      const bounds = L.latLngBounds(latlngs as L.LatLngTuple[]);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }, [sortedPoints, showPath, colorByDate, dateColorMap]);

  // Reset animation when underlying points change
  useEffect(() => {
    setPlaying(false);
    setAnimIndex(0);
    if (animTimerRef.current) {
      window.clearInterval(animTimerRef.current);
      animTimerRef.current = null;
    }
    animLayerRef.current?.clearLayers();
  }, [sortedPoints]);

  // Drive animated trail marker
  useEffect(() => {
    if (!animateTrail) return;
    const layer = animLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (sortedPoints.length === 0 || animIndex < 0 || animIndex >= sortedPoints.length) return;
    const p = sortedPoints[animIndex];
    const color = colorByDate
      ? (dateColorMap.get(dayKey(p.recordedAt)) || "hsl(0,75%,55%)")
      : "hsl(0,75%,55%)";
    L.circleMarker([p.lat, p.lng], {
      radius: 10,
      fillColor: color,
      color: "#fff",
      weight: 2.5,
      fillOpacity: 0.95,
    })
      .bindPopup(`<div style="font-size:11px;"><strong>${p.label || "Location"}</strong><br/>${p.recordedAt ? new Date(p.recordedAt).toLocaleString() : ""}</div>`)
      .addTo(layer);
  }, [animIndex, animateTrail, sortedPoints, colorByDate, dateColorMap]);

  // Play/pause loop
  useEffect(() => {
    if (!animateTrail) return;
    if (animTimerRef.current) {
      window.clearInterval(animTimerRef.current);
      animTimerRef.current = null;
    }
    if (!playing) return;
    animTimerRef.current = window.setInterval(() => {
      setAnimIndex(prev => {
        const next = prev + 1;
        if (next >= sortedPoints.length) {
          setPlaying(false);
          return sortedPoints.length - 1;
        }
        return next;
      });
    }, 250);
    return () => {
      if (animTimerRef.current) {
        window.clearInterval(animTimerRef.current);
        animTimerRef.current = null;
      }
    };
  }, [playing, sortedPoints.length, animateTrail]);

  const heightStyle = typeof height === "number" ? `${height}px` : height;
  const dateEntries = Array.from(dateColorMap.entries());
  const currentPoint = animateTrail && sortedPoints[animIndex];

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        style={{ height: heightStyle, minHeight: heightStyle, width: "100%", position: "relative" }}
        className="win98-sunken bg-[hsl(var(--win98-light))] leaflet-host"
      />

      {colorByDate && dateEntries.length > 0 && (
        <div className="win98-sunken bg-white p-1 flex flex-wrap gap-1 max-h-[60px] overflow-auto">
          <span className="text-[9px] font-bold mr-1">Dates:</span>
          {dateEntries.map(([day, color]) => (
            <span key={day} className="flex items-center gap-0.5 text-[9px]">
              <span style={{ background: color, width: 10, height: 10, display: "inline-block", border: "1px solid #fff" }} />
              {day}
            </span>
          ))}
        </div>
      )}

      {animateTrail && sortedPoints.length > 1 && (
        <div className="win98-raised bg-[hsl(var(--win98-face))] p-1 flex items-center gap-1">
          <button
            onClick={() => { setAnimIndex(0); setPlaying(false); }}
            className="win98-button text-[9px] flex items-center gap-0.5 px-1"
            title="Reset"
          >
            <SkipBack className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => {
              if (animIndex >= sortedPoints.length - 1) setAnimIndex(0);
              setPlaying(p => !p);
            }}
            className="win98-button text-[9px] flex items-center gap-0.5 px-1"
          >
            {playing ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, sortedPoints.length - 1)}
            value={animIndex}
            onChange={e => { setPlaying(false); setAnimIndex(Number(e.target.value)); }}
            className="flex-1"
          />
          <span className="text-[9px] font-[monospace] min-w-[110px] text-right">
            {animIndex + 1} / {sortedPoints.length}
            {currentPoint?.recordedAt && (
              <> · {new Date(currentPoint.recordedAt).toLocaleString()}</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
