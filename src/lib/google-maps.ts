// Loader único de Google Maps JS (Maps + Places New).
// Se asegura de NO insertar el script dos veces aunque varios componentes lo pidan.
declare global {
  interface Window {
    google?: any;
    __kpMapsInit?: () => void;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.google?.maps && loadPromise) return loadPromise;
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as
    | string
    | undefined;
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
      libraries: "places",
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
