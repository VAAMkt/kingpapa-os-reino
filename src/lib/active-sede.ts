// Estado global de sede activa + utilidades de cobertura.
// Persistencia: localStorage. SSR-safe (devuelve null en server).
import { useSyncExternalStore } from "react";
import type { SedeRow } from "@/lib/sedes";

const STORAGE_KEY = "kp.activeSede";
export const DEFAULT_COBERTURA_KM = 5;

export type ActiveSedeSource = "gps" | "address" | "manual" | "exploring";

export type ActiveSede = {
  sedeId: string;
  slug: string;
  label: string;
  source: ActiveSedeSource;
  distanciaKm?: number;
  enCobertura: boolean;
  ts: number;
  // v2: ubicación del usuario
  lat?: number;
  lng?: number;
  direccionTexto?: string;
  detalles?: string;
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

let cache: ActiveSede | null = null;
let cacheLoaded = false;

function read(): ActiveSede | null {
  if (typeof window === "undefined") return null;
  if (cacheLoaded) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as ActiveSede) : null;
  } catch {
    cache = null;
  }
  cacheLoaded = true;
  return cache;
}

export function setActiveSede(value: ActiveSede) {
  if (typeof window === "undefined") return;
  cache = value;
  cacheLoaded = true;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  emit();
}

export function clearActiveSede() {
  if (typeof window === "undefined") return;
  cache = null;
  cacheLoaded = true;
  window.localStorage.removeItem(STORAGE_KEY);
  emit();
}

/** Sede "vitrina" para que el usuario navegue sin elegir ubicación todavía. */
export function setExploringSede(sede: SedeRow) {
  setActiveSede({
    sedeId: sede.id,
    slug: sede.slug,
    label: `Explorando · ${sede.nombre}`,
    source: "exploring",
    enCobertura: false,
    ts: Date.now(),
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cacheLoaded = false;
      emit();
    }
  });
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
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
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
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
  const conGeo = sedes.filter((s) => s.lat != null && s.lng != null && s.publicado);
  if (conGeo.length === 0) return null;
  let best: NearestResult | null = null;
  for (const s of conGeo) {
    const d = haversineKm(point, { lat: Number(s.lat), lng: Number(s.lng) });
    const radio = Number(s.cobertura_radio_km ?? DEFAULT_COBERTURA_KM) || DEFAULT_COBERTURA_KM;
    const cur: NearestResult = {
      sede: s,
      distanciaKm: d,
      enCobertura: d <= radio,
    };
    if (!best || d < best.distanciaKm) best = cur;
  }
  return best;
}

/**
 * Recalcula `enCobertura` y la sede más cercana para un ActiveSede que ya tiene
 * lat/lng. Útil para resolver caches stale (ej. usuario marcado como "pickup"
 * pero su dirección sí está dentro del radio de alguna sede).
 *
 * Retorna `{ active, changed }` — `changed=true` cuando alguno de
 * `enCobertura | sedeId | distanciaKm` se actualizó.
 */
export function recomputeCoverage(
  active: ActiveSede | null,
  sedes: SedeRow[],
): { active: ActiveSede | null; changed: boolean } {
  if (!active || active.lat == null || active.lng == null || sedes.length === 0) {
    return { active, changed: false };
  }
  const r = pickNearestSede({ lat: active.lat, lng: active.lng }, sedes);
  if (!r) return { active, changed: false };
  const newDist = Math.round(r.distanciaKm * 10) / 10;
  const changed =
    active.enCobertura !== r.enCobertura ||
    active.sedeId !== r.sede.id ||
    active.distanciaKm !== newDist;
  if (!changed) return { active, changed: false };
  const next: ActiveSede = {
    ...active,
    sedeId: r.sede.id,
    slug: r.sede.slug,
    // Si recuperamos cobertura, limpiamos el label "Recoger en X" stale.
    label:
      r.enCobertura && active.label.toLowerCase().startsWith("recoger en")
        ? active.direccionTexto || r.sede.nombre
        : active.label,
    enCobertura: r.enCobertura,
    distanciaKm: newDist,
    ts: Date.now(),
  };
  return { active: next, changed: true };
}
