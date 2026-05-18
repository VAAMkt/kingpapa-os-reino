// Estado global de sede activa + utilidades de cobertura.
// Persistencia: localStorage. SSR-safe (devuelve null en server).
import { useSyncExternalStore } from "react";
import type { SedeRow } from "@/lib/sedes";

const STORAGE_KEY = "kp.activeSede";

export type ActiveSede = {
  sedeId: string;
  slug: string;
  label: string;
  source: "gps" | "address" | "manual";
  distanciaKm?: number;
  enCobertura: boolean;
  ts: number;
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function read(): ActiveSede | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActiveSede) : null;
  } catch {
    return null;
  }
}

export function setActiveSede(value: ActiveSede) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  emit();
}

export function clearActiveSede() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  emit();
}

function subscribe(l: Listener) {
  listeners.add(l);
  if (typeof window !== "undefined") {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) emit();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => listeners.delete(l);
}

export function useActiveSede(): ActiveSede | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

// Haversine en km.
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export type NearestResult = {
  sede: SedeRow;
  distanciaKm: number;
  enCobertura: boolean;
};

export function pickNearestSede(
  point: { lat: number; lng: number },
  sedes: SedeRow[],
): NearestResult | null {
  const conGeo = sedes.filter(
    (s) => s.lat != null && s.lng != null && s.publicado,
  );
  if (conGeo.length === 0) return null;
  let best: NearestResult | null = null;
  for (const s of conGeo) {
    const d = haversineKm(point, { lat: Number(s.lat), lng: Number(s.lng) });
    const radio = Number(s.cobertura_radio_km ?? 5);
    const cur: NearestResult = {
      sede: s,
      distanciaKm: d,
      enCobertura: d <= radio,
    };
    if (!best || d < best.distanciaKm) best = cur;
  }
  return best;
}
