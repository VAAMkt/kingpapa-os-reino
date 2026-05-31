// Helpers puros para normalizar respuestas crudas de Restaurant.pe.
// Sin secretos: pueden importarse desde cliente y server.

import type {
  RpLocal,
  RpCategoria,
  RpProducto,
  RpModificadorGrupo,
} from "@/types/restaurantpe";

// CDN real de Restaurant.pe (confirmada en su panel oficial: RESTPE_IMG.URL_BASE).
// `restaurant.pe/archivos/...` y `api.restaurant.pe/archivos/...` devuelven HTML/404,
// no imágenes. La buena es `https://img.restpe.com/<path>`.
const RP_IMG_BASE = "https://img.restpe.com/";

// Hosts viejos que hay que reescribir a la CDN buena (incluye URLs que ya
// quedaron guardadas en la base con el host incorrecto).
const BAD_HOSTS = [
  /^https?:\/\/(www\.)?restaurant\.pe\/archivos\//i,
  /^https?:\/\/api\.restaurant\.pe\/archivos\//i,
];

export function resolveRpImage(url: unknown): string | null {
  if (url == null) return null;
  const s = String(url).trim();
  if (!s) return null;
  for (const bad of BAD_HOSTS) {
    if (bad.test(s)) return s.replace(bad, RP_IMG_BASE);
  }
  if (/^https?:\/\//i.test(s)) return s;
  return RP_IMG_BASE + s.replace(/^\/+/, "");
}

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

// ---------------------------------------------------------------------------
// Helpers para sincronizar el estado/comanda del pedido desde Restaurant.pe.
// ---------------------------------------------------------------------------

export type RpOrderStatus =
  | "enviado"
  | "recibido"
  | "en_preparacion"
  | "en_camino"
  | "entregado"
  | "cancelado"
  | "error";

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Mapea el estado textual que devuelve el POS al status local.
 * Devuelve null si no reconoce el estado (no tocar el status actual).
 */
export function mapRpEstadoToStatus(estado: unknown): RpOrderStatus | null {
  if (estado == null) return null;
  const s = stripAccents(String(estado).toLowerCase()).trim();
  if (!s) return null;
  if (/(anulad|cancelad|rechazad)/.test(s)) return "cancelado";
  if (/(entregad|finalizad|completad)/.test(s)) return "entregado";
  if (/(reparto|en camino|despachad|salio)/.test(s)) return "en_camino";
  if (/(preparac|cocina|elabor)/.test(s)) return "en_preparacion";
  if (/(pendiente|registrad|recibid|nuev)/.test(s)) return "recibido";
  return null;
}

/**
 * Mapea el delivery_estado numérico que devuelve el endpoint público V2 de
 * Restaurant.pe (confirmado por soporte + inspección del DOM del POS):
 *   0 = pendiente, 1 = realizado/recibido, 2 = en preparación,
 *   3 = en camino, 4 = anulado/cancelado.
 * Devuelve null si el valor no se reconoce (no toca el status actual).
 */
export function mapDeliveryEstado(estado: unknown): RpOrderStatus | null {
  if (estado == null || estado === "") return null;
  const n = Number(estado);
  if (!Number.isFinite(n)) return null;
  switch (Math.trunc(n)) {
    case 0:
    case 1:
      return "recibido";
    case 2:
      return "en_preparacion";
    case 3:
      return "en_camino";
    case 4:
      return "cancelado";
    default:
      return null;
  }
}

/**
 * Extrae el número corto de comanda visible en el POS.
 * Esquema confirmado por soporte de Restaurant.pe:
 *   - `delivery_numero` (ej. "C10-12381")
 *   - fallback: `venta.venta_seriedoc` + "-" + `venta.venta_numdoc`
 */
export function extractComandaNumber(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null;
  const inner = (raw.data ?? raw) as Record<string, unknown>;
  const directo = inner.delivery_numero;
  if (directo != null && String(directo).trim() !== "") return String(directo).trim();
  const venta = inner.venta as Record<string, unknown> | undefined;
  if (venta) {
    const serie = venta.venta_seriedoc;
    const num = venta.venta_numdoc;
    if (serie != null && num != null && String(num).trim() !== "") {
      return `${String(serie).trim()}-${String(num).trim()}`;
    }
  }
  // Legacy fallbacks (por si algún endpoint viejo sigue activo).
  const legacy = [inner.pedido_numero, inner.numero_comanda, inner.comanda];
  for (const v of legacy) {
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/** Nombre del motorizado asignado (ej. "Rappi App"). */
export function extractMotorizado(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null;
  const inner = (raw.data ?? raw) as Record<string, unknown>;
  const v = inner.motorizado;
  if (v != null && String(v).trim() !== "") return String(v).trim();
  return null;
}

/** Estado numérico crudo (`delivery_estado`). */
export function extractDeliveryEstado(raw: Record<string, unknown> | null): number | null {
  if (!raw) return null;
  const inner = (raw.data ?? raw) as Record<string, unknown>;
  const v = inner.delivery_estado;
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Extrae el estado textual desde un item crudo del POS (fallback legacy).
 */
export function extractEstadoTexto(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null;
  const inner = (raw.data ?? raw) as Record<string, unknown>;
  const candidates = [
    inner.estado_nombre,
    inner.pedido_estado_nombre,
    inner.estado,
    inner.pedido_estado,
    inner.estado_descripcion,
  ];
  for (const v of candidates) {
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

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

export function normalizeCategoria(
  raw: RpCategoria,
  index = 0,
): NormalizedCategoria {
  const r = raw as Record<string, unknown>;
  const delivery = String(r["categoria_delivery"] ?? "").trim();
  const estado = String(r["categoria_estado"] ?? "").trim().toLowerCase();
  // Si la sede manda los flags, exigimos ambos. Si NO los manda (vienen vacíos),
  // dejamos la categoría activa por defecto — algunas sedes no emiten los flags
  // y bloquear todo dejaba el menú vacío.
  const tieneFlags = delivery !== "" || estado !== "";
  const activo = tieneFlags
    ? delivery === "1" && (estado === "1" || estado === "activo")
    : true;
  const ordenRaw = raw.categoria_orden;
  const orden =
    ordenRaw != null && String(ordenRaw).trim() !== ""
      ? toInt(ordenRaw)
      : index;
  return {
    rp_id: toInt(raw.categoria_id),
    nombre: String(raw.categoria_descripcion ?? ""),
    orden,
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
  modificadores_raw: Record<string, unknown>;
  almacen_id: number | null;
  orden: number;
};

export function normalizeProduct(
  raw: RpProducto,
  index = 0,
): NormalizedProducto | null {
  const r = raw as Record<string, unknown>;
  const rpId = raw.productogeneral_id ?? raw.producto_id;
  const nombre =
    (raw.producto_descripcion as string | undefined) ??
    (raw.productogeneral_descripcion as string | undefined) ??
    "";

  // === Lógica condicional Combos vs Normales (OAS3 Restaurant.pe) ===
  const esCombo = String(r["productogeneral_escombo"] ?? "0") === "1";
  const presentaciones = Array.isArray(raw.lista_presentacion)
    ? (raw.lista_presentacion as Record<string, unknown>[])
    : [];

  // Precio: combo => productogeneral_precio | producto normal => primera presentación
  const precio = esCombo
    ? toNum(
        r["productogeneral_precio"] ??
          r["productogeneral_preciofijo"] ??
          presentaciones[0]?.["producto_precio"],
      )
    : toNum(presentaciones[0]?.["producto_precio"] ?? r["productogeneral_precio"]);
  if (precio <= 0) return null;

  // Imagen: cada producto debe tener la SUYA.
  // - Combos: muchas veces `productogeneral_urlimagen` viene null. La foto real
  //   vive en `lista_productobase[0].producto_urlimagen` (la papa base del
  //   combo). Fallback final a `lista_productoCambio[0]` o legacy.
  // - Normales: SIEMPRE la de la presentación primero (es la real). Solo si la
  //   presentación no trae imagen caemos al padre/legacy.
  const imgPresentacion = presentaciones[0]?.["producto_urlimagen"] as
    | string
    | undefined;
  const imgGeneral = r["productogeneral_urlimagen"] as string | undefined;
  const imgLegacy = raw.producto_imagen as string | undefined;

  const baseList = Array.isArray(r["lista_productobase"])
    ? (r["lista_productobase"] as Record<string, unknown>[])
    : [];
  const imgBase = baseList[0]?.["producto_urlimagen"] as string | undefined;
  const cambioList = Array.isArray(baseList[0]?.["lista_productoCambio"])
    ? (baseList[0]!["lista_productoCambio"] as Record<string, unknown>[])
    : [];
  const imgCambio = cambioList[0]?.["producto_urlimagen"] as string | undefined;

  const imgRel = esCombo
    ? (imgGeneral ?? imgBase ?? imgCambio ?? imgLegacy)
    : (imgPresentacion ?? imgLegacy ?? imgGeneral ?? imgBase);
  const imagen = resolveRpImage(imgRel);

  // Delivery activo: combo siempre true; normal => alguna presentación con producto_delivery==="1"
  // Si el normal NO trae presentaciones (legacy), aceptamos.
  const activoDelivery = esCombo
    ? true
    : presentaciones.length === 0
      ? true
      : presentaciones.some(
          (p) => String(p["producto_delivery"] ?? "0") === "1",
        );
  if (!activoDelivery) return null;

  const descripcionLarga =
    (r["productogeneral_descripcionweb"] as string | undefined) ??
    (raw.productogeneral_descripcion as string | undefined) ??
    (raw.producto_descripcion_larga as string | undefined) ??
    null;
  const mods = raw.modificadores ?? raw.listaModificadores;

  // Estado / disponibilidad
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

  // Guardamos el raw completo de modificadores + base + adicionales para upselling
  const modificadoresRaw: Record<string, unknown> = {
    listaModificadores: raw.listaModificadores ?? raw.modificadores ?? [],
    lista_productobase: raw.lista_productobase ?? [],
    lista_productoadicional: raw.lista_productoadicional ?? [],
    es_combo: esCombo,
  };

  return {
    rp_id: toInt(rpId),
    rp_categoria_id: raw.categoria_id != null ? toInt(raw.categoria_id) : null,
    nombre: String(nombre),
    descripcion: descripcionLarga,
    precio,
    imagen_url: imagen,
    disponible,
    modificadores: normalizeModifiers(mods),
    modificadores_raw: modificadoresRaw,
    almacen_id: raw.almacen_id != null ? toInt(raw.almacen_id) : null,
    orden: index,
  };
}
