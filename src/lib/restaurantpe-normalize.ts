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
  activo: boolean;
};

export function normalizeCategoria(raw: RpCategoria): NormalizedCategoria {
  const r = raw as Record<string, unknown>;
  const delivery = String(r["categoria_delivery"] ?? "").trim();
  const estado = String(r["categoria_estado"] ?? "").trim().toLowerCase();
  // Si la API no manda ninguno de los dos flags, asumimos activo (no romper sedes
  // cuyo POS no envíe la columna). Si manda al menos uno, exigimos "1"/"activo".
  const hasFlag = delivery !== "" || estado !== "";
  const activo = hasFlag
    ? delivery === "1" || estado === "1" || estado === "activo"
    : true;
  return {
    rp_id: toInt(raw.categoria_id),
    nombre: String(raw.categoria_descripcion ?? ""),
    orden: raw.categoria_orden != null ? toInt(raw.categoria_orden) : 0,
    activo,
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

export function normalizeProduct(raw: RpProducto): NormalizedProducto | null {
  const r = raw as Record<string, unknown>;
  // Priorizar productogeneral_id (único entre sedes).
  const rpId = raw.productogeneral_id ?? raw.producto_id;
  const nombre =
    (raw.producto_descripcion as string | undefined) ??
    (raw.productogeneral_descripcion as string | undefined) ??
    "";

  // Filtro delivery: si hay lista_presentacion, exigir al menos una con
  // producto_delivery === "1". Si no hay lista_presentacion, caemos al
  // comportamiento legacy (sin filtrar) para no romper sedes que no la envíen.
  const presentaciones = Array.isArray(raw.lista_presentacion)
    ? (raw.lista_presentacion as Record<string, unknown>[])
    : [];
  let presentacionActiva: Record<string, unknown> | null = null;
  if (presentaciones.length > 0) {
    presentacionActiva =
      presentaciones.find((p) => String(p["producto_delivery"] ?? "") === "1") ??
      null;
    if (!presentacionActiva) return null; // ninguna presentación delivery → descartar
  }

  const precio =
    (presentacionActiva?.["producto_precio"] as number | string | undefined) ??
    raw.producto_precio ??
    raw.productogeneral_preciofijo ??
    0;
  const imagen =
    (presentacionActiva?.["producto_urlimagen"] as string | undefined) ??
    (r["productogeneral_urlimagen"] as string | undefined) ??
    (raw.producto_imagen as string | undefined) ??
    null;
  const descripcionLarga =
    (r["productogeneral_descripcionweb"] as string | undefined) ??
    (raw.productogeneral_descripcion as string | undefined) ??
    (raw.producto_descripcion_larga as string | undefined) ??
    null;
  const mods = raw.modificadores ?? raw.listaModificadores;
  const estado = r["productogeneral_estado"];
  const estadoActivo = (() => {
    if (estado == null) return null;
    const s = String(estado).trim().toLowerCase();
    if (s === "1" || s === "true" || s === "activo") return true;
    if (s === "0" || s === "false" || s === "inactivo") return false;
    return null;
  })();
  const disponible =
    raw.producto_agotado != null
      ? !toBool01(raw.producto_agotado)
      : estadoActivo ?? true;
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
