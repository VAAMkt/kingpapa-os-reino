// Mini-mapa con pin arrastrable. Usa el loader compartido en lib/google-maps.
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { loadGoogleMaps } from "@/lib/google-maps";

type LatLng = { lat: number; lng: number };

export function GateMap({
  center,
  onPinChange,
}: {
  center: LatLng;
  onPinChange: (p: LatLng) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !elRef.current || !window.google) return;
        const g = window.google;
        const map = new g.maps.Map(elRef.current, {
          center,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        const marker = new g.maps.Marker({
          position: center,
          map,
          draggable: true,
        });
        marker.addListener("dragend", () => {
          const p = marker.getPosition();
          if (p) onPinChange({ lat: p.lat(), lng: p.lng() });
        });
        map.addListener("click", (e: any) => {
          if (!e.latLng) return;
          const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.setPosition(p);
          onPinChange(p);
        });
        mapRef.current = map;
        markerRef.current = marker;
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Error de mapa");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !markerRef.current) return;
    markerRef.current.setPosition(center);
    mapRef.current.panTo(center);
  }, [center.lat, center.lng, ready]);

  return (
    <div className="relative border-2 border-kp-ink shadow-brutal-sm overflow-hidden">
      <div ref={elRef} className="w-full h-56 bg-kp-cheese" />
      {!ready && !error && (
        <div className="absolute inset-0 p-2 bg-kp-cheese">
          <Skeleton className="w-full h-full" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-kp-cheese p-3 text-center text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
