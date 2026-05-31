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
 */
function getSubdominio(): string {
  return (process.env.RESTAURANT_PE_SUBDOMINIO || "kingpapa").trim();
}

/**
 * Endpoint descubierto vía DevTools del panel POS:
 *   GET http://{sub}.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/{deliveryId}
 *
 * El `deliveryId` es el escalar que devuelve `registrarDelivery`. La respuesta
 * lista los pedidos amarrados a ese delivery; el primer item trae el número
 * corto de comanda (visible en el POS, ej. 158719) y el estado real.
 *
 * Estrategia:
 *   1. Ruta interna del POS (la que vimos en network) — más probable que funcione.
 *   2. Fallback a la base pública v2 por si la migran allí.
 *
 * NUNCA lanza: devuelve la primera respuesta exitosa o null.
 */
export async function rpGetPedidoListByDelivery(
  deliveryId: number | string,
): Promise<{ raw: unknown; firstItem: Record<string, unknown> | null } | null> {
  const sub = getSubdominio();
  const dominioId = getDominioId();
  const candidates: string[] = [
    `http://${sub}.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/${deliveryId}`,
    `${WRITE_BASE}/pedido/getPedidoListByDelivery/${dominioId}/${deliveryId}`,
  ];

  let lastStatus: number | null = null;
  for (const url of candidates) {
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
      clearTimeout(timeout);
      lastStatus = res.status;
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, unknown>;
      // El envelope de Restaurant.pe normalmente es { tipo:"1", data:[...] }.
      // Si tipo viene presente y no es "1", tratamos como fallo.
      if (json.tipo != null && String(json.tipo) !== "1") continue;
      const data = (json.data ?? json) as unknown;
      const first = Array.isArray(data)
        ? ((data[0] as Record<string, unknown>) ?? null)
        : data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : null;
      return { raw: json, firstItem: first };
    } catch {
      clearTimeout(timeout);
      continue;
    }
  }

  // Log de fallo (best-effort, no romper si tampoco se puede loguear).
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "poll_pedido",
      ok: false,
      mensaje: `getPedidoListByDelivery falló (lastStatus=${lastStatus ?? "n/d"})`,
      payload: { delivery_id: String(deliveryId), candidates } as never,
    });
  } catch {
    // ignore
  }
  return null;
}

/**
 * @deprecated Reemplazado por `rpGetPedidoListByDelivery`. Mantenido como
 * shim para que código antiguo siga compilando; siempre devuelve null.
 */
export async function rpObtenerPedido(_pedidoId: number | string): Promise<unknown | null> {
  return null;
}
