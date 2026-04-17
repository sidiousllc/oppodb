import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
}

export function LocationMap({ points, height = 320, showPath = false }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

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
    mapRef.current = map;

    // Resize observer to invalidate map size when container changes
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    // Force size recalculation after mount (fixes blank map in tabs/modals)
    const timers = [50, 150, 400, 1000, 2000].map(ms =>
      setTimeout(() => {
        try { map.invalidateSize(); } catch {}
      }, ms)
    );

    // Also invalidate when window resizes or visibility changes
    const onVis = () => { try { map.invalidateSize(); } catch {} };
    window.addEventListener("resize", onVis);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", onVis);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (points.length === 0) return;

    const latlngs: L.LatLngExpression[] = [];
    for (const p of points) {
      const ll: L.LatLngExpression = [p.lat, p.lng];
      latlngs.push(ll);
      const marker = L.circleMarker(ll, {
        radius: 6,
        fillColor: p.color || "hsl(220, 90%, 55%)",
        color: "#fff",
        weight: 1.5,
        fillOpacity: 0.85,
      });
      const popup = `
        <div style="font-size:11px;">
          <strong>${p.label || "Location"}</strong><br/>
          ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}<br/>
          ${p.recordedAt ? new Date(p.recordedAt).toLocaleString() : ""}
        </div>
      `;
      marker.bindPopup(popup);
      marker.addTo(layer);
    }

    if (showPath && latlngs.length > 1) {
      L.polyline(latlngs, { color: "hsl(220, 90%, 55%)", weight: 2, opacity: 0.6 }).addTo(layer);
    }

    if (latlngs.length === 1) {
      map.setView(latlngs[0], 13);
    } else {
      const bounds = L.latLngBounds(latlngs as L.LatLngTuple[]);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }, [points, showPath]);

  const heightStyle = typeof height === "number" ? `${height}px` : height;
  return (
    <div
      ref={containerRef}
      style={{ height: heightStyle, minHeight: heightStyle, width: "100%", position: "relative" }}
      className="win98-sunken bg-[hsl(var(--win98-light))] leaflet-host"
    />
  );
}
