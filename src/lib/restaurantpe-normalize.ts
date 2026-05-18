// Helpers puros para normalizar respuestas crudas de Restaurant.pe.
// Sin secretos: pueden importarse desde cliente y server.

import type {
  RpLocal,
  RpCategoria,
  RpProducto,
  RpModificadorGrupo,
} from "@/types/restaurantpe";

const toNum = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const toInt = (v: unknown): number => Math.trunc(toNum(v));

const toBool01 = (v: unknown): boolean => String(v ?? "0") === "1";

export type NormalizedLocal = {
  rp_local_id: number;
  nombre: string;
  direccion: string | null;
  delivery: boolean;
  pickup: boolean;
  lat: number | null;
  lng: number | null;
  almacen_id: number | null;
};

export function normalizeBranch(raw: RpLocal): NormalizedLocal {
  return {
    rp_local_id: toInt(raw.local_id),
    nombre: String(raw.local_descripcion ?? ""),
    direccion: (raw.local_direccion as string | undefined) ?? null,
    delivery: toBool01(raw.local_aceptadelivery),
    pickup: toBool01(raw.local_aceptarecojo),
    lat: raw.local_latitud != null ? toNum(raw.local_latitud) : null,
    lng: raw.local_longitud != null ? toNum(raw.local_longitud) : null,
    almacen_id: raw.almacen_id != null ? toInt(raw.almacen_id) : null,
  };
}

export type NormalizedCategoria = {
  rp_id: number;
  nombre: string;
  orden: number;
};

export function normalizeCategoria(raw: RpCategoria): NormalizedCategoria {
  return {
    rp_id: toInt(raw.categoria_id),
    nombre: String(raw.categoria_descripcion ?? ""),
    orden: raw.categoria_orden != null ? toInt(raw.categoria_orden) : 0,
  };
}

export type NormalizedModifierOption = {
  id: number;
  nombre: string;
  precio: number;
};

export type NormalizedModifierGroup = {
  id: number;
  nombre: string;
  min: number;
  max: number;
  opciones: NormalizedModifierOption[];
};

export function normalizeModifiers(
  groups: RpModificadorGrupo[] | undefined,
): NormalizedModifierGroup[] {
  if (!groups || !Array.isArray(groups)) return [];
  return groups.map((g) => ({
    id: toInt(g.grupo_id),
    nombre: String(g.grupo_descripcion ?? ""),
    min: toInt(g.grupo_min),
    max: Math.max(toInt(g.grupo_max), 1),
    opciones: (g.opciones ?? []).map((o) => ({
      id: toInt(o.modificador_id),
      nombre: String(o.modificador_descripcion ?? ""),
      precio: toNum(o.modificador_precio),
    })),
  }));
}

export type NormalizedProducto = {
  rp_id: number;
  rp_categoria_id: number | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagen_url: string | null;
  disponible: boolean;
  modificadores: NormalizedModifierGroup[];
  almacen_id: number | null;
};

export function normalizeProduct(raw: RpProducto): NormalizedProducto {
  const r = raw as Record<string, unknown>;
  const rpId = raw.producto_id ?? raw.productogeneral_id;
  const nombre =
    (raw.producto_descripcion as string | undefined) ??
    (raw.productogeneral_descripcion as string | undefined) ??
    "";
  const precio = raw.producto_precio ?? raw.productogeneral_preciofijo ?? 0;
  const mods = raw.modificadores ?? raw.listaModificadores;
  const descripcionLarga =
    (raw.producto_descripcion_larga as string | undefined) ??
    (r["productogeneral_descripcionweb"] as string | undefined) ??
    null;
  const imagen =
    (raw.producto_imagen as string | undefined) ??
    (r["productogeneral_urlimagen"] as string | undefined) ??
    null;
  const estado = r["productogeneral_estado"];
  const disponible =
    raw.producto_agotado != null
      ? !toBool01(raw.producto_agotado)
      : estado != null
        ? toBool01(estado)
        : true;
  return {
    rp_id: toInt(rpId),
    rp_categoria_id: raw.categoria_id != null ? toInt(raw.categoria_id) : null,
    nombre: String(nombre),
    descripcion: descripcionLarga,
    precio: toNum(precio),
    imagen_url: imagen && String(imagen).trim() !== "" ? String(imagen) : null,
    disponible,
    modificadores: normalizeModifiers(mods),
    almacen_id: raw.almacen_id != null ? toInt(raw.almacen_id) : null,
  };
}
