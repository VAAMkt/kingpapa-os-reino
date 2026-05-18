// Mini-mapa con pin arrastrable. Carga Maps JS async, una sola vez.
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type LatLng = { lat: number; lng: number };

declare global {
  interface Window {
    google?: any;
    __kpMapsInit?: () => void;
  }
}

let loadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
    | string
    | undefined;
  const channel = import.meta.env
    .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (!key) {
    return Promise.reject(new Error("Falta VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"));
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    window.__kpMapsInit = () => resolve();
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      loading: "async",
      callback: "__kpMapsInit",
      language: "es",
      region: "CO",
    });
    if (channel) params.set("channel", channel);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("No se pudo cargar Google Maps"));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

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

  // Inicializar una sola vez
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

  // Mover el pin/centro cuando cambia desde fuera
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
