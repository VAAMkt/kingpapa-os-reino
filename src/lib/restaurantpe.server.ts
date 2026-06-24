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
    // Devolvemos el envelope completo porque necesitamos json.data y json.delivery
    return json;
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
    // Devolvemos el envelope completo porque necesitamos json.data y json.delivery
    return json;
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
// Reconciliación pull: DESHABILITADA.
//
// Fase A discovery (jun-2026) confirmó que ni el host por tenant
// (`https://{sub}.{host}/restaurant/api/rest`) ni el host público
// (`api.restaurant.pe/{readonly|public/v2}/rest`) exponen un GET de lectura
// por delivery/pedido que acepte `RESTAURANT_PE_TOKEN`:
//   - Tenant: HTTP 401 "Token inválido" en todos los nodos (requiere token
//     de sesión tenant, distinto al de integración).
//   - Público: HTTP 404 en /delivery/get, /obtenerSyncFull, /obtenerDelivery,
//     /obtenerPedido, /obtenerEstadoDelivery (variantes con y sin dominio_id,
//     con y sin ?quipupos=0).
//
// Decisión: dependemos 100% del webhook entrante (`/api/public/rp-webhook`)
// + Auto-Kill TTL 45 min en `orders.reconcile.functions.ts`. Las funciones
// `rpGetDeliveryById`, `rpObtenerSyncFull`, `rpFetchTenant`, `buildTenantBase`,
// `extractEstado` fueron eliminadas para no generar ruido 401 en `rp_sync_log`.
// ---------------------------------------------------------------------------




