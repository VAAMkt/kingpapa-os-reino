// Cliente HTTP server-only para Restaurant.pe API (OAS3).
// SERVER-ONLY: import desde createServerFn .handler() o desde *.server.ts.
// Nunca importar desde código de cliente — usa el token privado.

import type {
  RpEnvelope,
  RpDominioData,
  RpMenuData,
  RpStockData,
} from "@/types/restaurantpe";

const HOST = "http://api.restaurant.pe/restaurant";
const READ_BASE = `${HOST}/readonly/rest`;
const WRITE_BASE = `${HOST}/public/v2/rest`;
const TIMEOUT_MS = 10_000;

function authHeader() {
  const token = process.env.RESTAURANT_PE_TOKEN;
  if (!token) throw new Error("RESTAURANT_PE_TOKEN no configurado");
  return `Token token="${token}"`;
}

function getDominioId(): string {
  const raw = process.env.RESTAURANT_PE_DOMINIO;
  if (!raw) throw new Error("RESTAURANT_PE_DOMINIO no configurado");
  const digits = String(raw).match(/\d+/);
  if (!digits)
    throw new Error("RESTAURANT_PE_DOMINIO debe contener el id numérico del dominio");
  return digits[0];
}

type RpBase = "read" | "write";

async function rpFetch<T>(
  path: string,
  opts: { base: RpBase } & RequestInit,
): Promise<T> {
  const { base, ...init } = opts;
  const baseUrl = base === "read" ? READ_BASE : WRITE_BASE;
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: authHeader(),
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(init.headers ?? {}),
        },
      });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`Restaurant.pe ${res.status} ${res.statusText} en ${path}`);
      }
      const json = (await res.json()) as RpEnvelope<T>;
      if (String(json.tipo) !== "1") {
        const msg = json.mensajes?.join("; ") || `Error tipo=${json.tipo}`;
        throw new Error(`Restaurant.pe: ${msg}`);
      }
      return json.data;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Restaurant.pe: error desconocido");
}

export async function rpGetDominioInfo(): Promise<RpDominioData> {
  const dominioId = getDominioId();
  return rpFetch<RpDominioData>(
    `/delivery/obtenerInformacionDominio/${dominioId}?quipupos=0`,
    { base: "read" },
  );
}

export async function rpGetCatalogo(localId: string | number): Promise<RpMenuData> {
  if (localId == null || String(localId).trim() === "") {
    throw new Error("rpGetCatalogo requiere localId (rp_local_id de la sede)");
  }
  const dominioId = getDominioId();
  // Para el catálogo necesitamos el envelope completo: `data` trae los
  // productos como array directo, pero `listaCategorias` vive en la raíz
  // del JSON (al mismo nivel que `data`). Si usáramos rpFetch perderíamos
  // las categorías. Hacemos el fetch manualmente y devolvemos el envelope.
  const url = `${READ_BASE}/delivery/obtenerCartaPorLocal/${dominioId}/${localId}?quipupos=0`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(
        `Restaurant.pe ${res.status} ${res.statusText} en obtenerCartaPorLocal/${dominioId}/${localId}`,
      );
    }
    const json = (await res.json()) as RpMenuData & { tipo?: string | number; mensajes?: string[] };
    if (String(json.tipo) !== "1") {
      const msg = json.mensajes?.join("; ") || `Error tipo=${json.tipo}`;
      throw new Error(`Restaurant.pe: ${msg}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export async function rpGetStock(input: {
  productoId: number;
  localId: number;
  almacenId: number;
}): Promise<RpStockData> {
  const dominioId = getDominioId();
  return rpFetch<RpStockData>(
    `/delivery/getStockProducto/${dominioId}?quipupos=0`,
    {
      base: "write",
      method: "POST",
      body: JSON.stringify({
        producto_id: input.productoId,
        local_id: input.localId,
        almacen_id: input.almacenId,
      }),
    },
  );
}

/**
 * Cancela un delivery ya registrado en Restaurant.pe.
 * Swagger V2: POST /delivery/cancelarDelivery/{dominio_id}
 * Body: { delivery_id, motivo }
 */
export async function rpCancelarDelivery(input: {
  deliveryId: number | string;
  motivo: string;
}): Promise<unknown> {
  const dominioId = getDominioId();
  const url = `${WRITE_BASE}/delivery/cancelarDelivery/${dominioId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        delivery_id: Number(input.deliveryId),
        motivo: input.motivo,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Restaurant.pe ${res.status} ${res.statusText} en cancelarDelivery`,
      );
    }
    const json = (await res.json()) as RpEnvelope<unknown>;
    if (String(json.tipo) !== "1") {
      const msg = json.mensajes?.join("; ") || `Error tipo=${json.tipo}`;
      throw new Error(`Restaurant.pe: ${msg}`);
    }
    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Pre-check de stock antes del checkout. Diseño defensivo (fallo suave):
 * timeout estricto de 3s. Si la API se cae o tarda, devuelve null para que
 * el caller asuma "todos disponibles" y NO bloquee la venta.
 *
 * Swagger V2: POST /delivery/verificarProductosAgotados/{dominio_id}
 * Body: { local_id, lista_productos: [{ pedido_productoid, pedido_cantidad }] }
 * Respuesta esperada: data = [{ pedido_productoid, agotado: 1|0 }] (best-effort).
 */
export async function rpVerificarProductosAgotados(input: {
  localId: number;
  productos: Array<{ pedido_productoid: number; pedido_cantidad: number }>;
  timeoutMs?: number;
}): Promise<Array<{ pedido_productoid: number; agotado: boolean }> | null> {
  const dominioId = getDominioId();
  const url = `${WRITE_BASE}/delivery/verificarProductosAgotados/${dominioId}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), input.timeoutMs ?? 3_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        local_id: input.localId,
        lista_productos: input.productos,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as RpEnvelope<unknown>;
    if (String(json.tipo) !== "1") return null;
    const data = json.data;
    const rows = Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : [];
    return rows.map((r) => ({
      pedido_productoid: Number(r.pedido_productoid ?? r.producto_id ?? 0),
      agotado:
        Number(r.agotado ?? r.es_agotado ?? r.sin_stock ?? 0) === 1 ||
        r.agotado === true,
    }));
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function rpRegistrarDelivery(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const dominioId = getDominioId();
  const url = `${WRITE_BASE}/delivery/registrarDelivery/${dominioId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(
        `Restaurant.pe ${res.status} ${res.statusText} en registrarDelivery`,
      );
    }
    const json = (await res.json()) as RpEnvelope<unknown>;
    if (String(json.tipo) !== "1") {
      const msg = json.mensajes?.join("; ") || `Error tipo=${json.tipo}`;
      throw new Error(`Restaurant.pe: ${msg}`);
    }
    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Subdominio del tenant en Restaurant.pe (ej. "kingpapa").
 * Distinto al id numérico de `RESTAURANT_PE_DOMINIO` (ej. "5272").
 * Fallback a "kingpapa" porque hoy es el único tenant.
 *
 * Se mantiene exportado por si futuras integraciones lo requieren.
 * Las funciones de polling (`rpObtenerDelivery`, `rpGetPedidoListByDelivery`,
 * `rpObtenerPedido`) fueron eliminadas: dependemos del webhook + Realtime.
 */
export function getSubdominio(): string {
  return (process.env.RESTAURANT_PE_SUBDOMINIO || "kingpapa").trim();
}

// ---------------------------------------------------------------------------
// Reconciliación pull vía tenant token (Fase 1+2 — jul-2026).
//
// Endpoints tenant que SÍ funcionan con `RESTAURANT_PE_TENANT_TOKEN`
// (distinto al `RESTAURANT_PE_TOKEN` de integración pública):
//   - GET /delivery/obtenerDeliverysSinNotificarAQuipu/{local_id}
//       → lista de deliveries que llegaron a la web pero NO al Quipu POS.
//   - GET /delivery/obtenerDelivery/{delivery_id}
//       → snapshot completo de un delivery (estado, tiempos, motorizado, etc.).
//
// Viven en el host del tenant (`https://kingpapa.restaurant.pe/restaurant/api/rest`),
// no en el host público. El token de integración devuelve 401 aquí.
// ---------------------------------------------------------------------------

function tenantAuthHeader(): string {
  const token = process.env.RESTAURANT_PE_TENANT_TOKEN;
  if (!token) throw new Error("RESTAURANT_PE_TENANT_TOKEN no configurado");
  return `Token token="${token}"`;
}

function tenantBase(): string {
  const explicit = process.env.RESTAURANT_PE_DOMINIO_HOST;
  if (explicit && explicit.trim() !== "") {
    return explicit.replace(/\/+$/, "");
  }
  const sub = getSubdominio();
  return `https://${sub}.restaurant.pe/restaurant/api/rest`;
}

async function rpTenantFetch<T = unknown>(
  path: string,
  init: { timeoutMs?: number } = {},
): Promise<T> {
  const url = `${tenantBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    init.timeoutMs ?? TIMEOUT_MS,
  );
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: tenantAuthHeader(),
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Restaurant.pe tenant ${res.status} en ${path}`);
    }
    const json = (await res.json()) as {
      tipo?: string | number;
      mensajes?: string[];
      data?: T;
    };
    if (String(json.tipo) !== "1") {
      const msg = json.mensajes?.join("; ") || `Error tipo=${json.tipo}`;
      throw new Error(`Restaurant.pe tenant: ${msg}`);
    }
    return (json.data ?? (null as unknown)) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Snapshot completo de un delivery (>150 columnas). */
export async function rpGetDeliveryById(
  deliveryId: string | number,
): Promise<Record<string, unknown> | null> {
  const id = String(deliveryId).trim();
  if (!id) throw new Error("rpGetDeliveryById requiere deliveryId");
  return rpTenantFetch<Record<string, unknown>>(
    `/delivery/obtenerDelivery/${id}`,
  );
}

export type RpSinQuipuRow = {
  delivery_id: string;
  delivery_fecha: string | null;
  delivery_codigointegracion: string | null;
  delivery_estado: number | null;
  delivery_recibidoenquipu: number | null;
  local_id: number | null;
  delivery_nombres: string | null;
  delivery_celular: string | null;
};

/**
 * Deliveries del local que llegaron a la web de Restaurant.pe pero NO
 * fueron notificados/recibidos por el POS Quipu. Es la misma lista que
 * Restaurant muestra en su UI ("Aún no ha llegado a Quipu").
 */
export async function rpGetSinNotificarAQuipu(
  localId: string | number,
): Promise<RpSinQuipuRow[]> {
  const id = String(localId).trim();
  if (!id) throw new Error("rpGetSinNotificarAQuipu requiere localId");
  const data = await rpTenantFetch<Record<string, unknown>[]>(
    `/delivery/obtenerDeliverysSinNotificarAQuipu/${id}`,
  );
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r) => ({
    delivery_id: String(r.delivery_id ?? ""),
    delivery_fecha:
      r.delivery_fecha != null ? String(r.delivery_fecha) : null,
    delivery_codigointegracion:
      r.delivery_codigointegracion != null &&
      String(r.delivery_codigointegracion).trim() !== ""
        ? String(r.delivery_codigointegracion)
        : null,
    delivery_estado:
      r.delivery_estado != null && r.delivery_estado !== ""
        ? Number(r.delivery_estado)
        : null,
    delivery_recibidoenquipu:
      r.delivery_recibidoenquipu != null
        ? Number(r.delivery_recibidoenquipu)
        : null,
    local_id: r.local_id != null ? Number(r.local_id) : null,
    delivery_nombres:
      r.delivery_nombres != null ? String(r.delivery_nombres) : null,
    delivery_celular:
      r.delivery_celular != null ? String(r.delivery_celular) : null,
  }));
}





