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
 * Tracking de guerrilla: el Swagger oficial V2 NO expone un GET público para
 * consultar el estado de un delivery. La única vía que devuelve la cabecera
 * con `delivery_numero`/`delivery_estado` es el endpoint INTERNO del POS bajo
 * el subdominio del tenant. Requiere un token de sesión del POS distinto al
 * token público de la API V2: usamos EXCLUSIVAMENTE RESTAURANT_PE_POS_TOKEN.
 *
 * Si el token no está configurado o el endpoint falla, devolvemos null sin
 * lanzar — el TrackerOperativo cae en Realtime como única fuente de verdad.
 */
export async function rpObtenerDelivery(
  deliveryId: number | string,
): Promise<{ raw: unknown; delivery: Record<string, unknown> | null } | null> {
  const posToken = (process.env.RESTAURANT_PE_POS_TOKEN || "").trim();
  if (!posToken) return null; // no-op silencioso

  const sub = getSubdominio();
  const url = `http://${sub}.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/${deliveryId}`;
  const auth = `Token token="${posToken}"`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let attempt: {
    url: string;
    status: number | null;
    tipo?: unknown;
    mensajes?: unknown;
    snippet?: string;
    error?: string;
  } = { url, status: null };

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: auth, Accept: "application/json" },
    });
    clearTimeout(timeout);
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { /* not JSON */ }

    if (res.ok && parsed && (parsed.tipo == null || String(parsed.tipo) === "1")) {
      const data = (parsed.data ?? parsed) as unknown;
      const delivery = Array.isArray(data)
        ? ((data[0] as Record<string, unknown>) ?? null)
        : data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : null;
      return { raw: parsed, delivery };
    }
    attempt = {
      url,
      status: res.status,
      tipo: parsed?.tipo,
      mensajes: parsed?.mensajes,
      snippet: parsed ? undefined : text.slice(0, 200),
    };
  } catch (err) {
    clearTimeout(timeout);
    attempt = {
      url,
      status: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Log detallado del fallo. Dedupe a 10 min para no inundar la tabla.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recientes } = await supabaseAdmin
      .from("rp_sync_log")
      .select("id")
      .eq("tipo", "poll_pedido")
      .eq("ok", false)
      .gt("created_at", tenMinAgo)
      .limit(1);
    if (!recientes || recientes.length === 0) {
      await supabaseAdmin.from("rp_sync_log").insert({
        tipo: "poll_pedido",
        ok: false,
        mensaje: `getPedidoListByDelivery falló (delivery_id=${deliveryId})`,
        payload: { delivery_id: String(deliveryId), attempt } as never,
      });
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Cancela un delivery en Restaurant.pe (spec V2 oficial).
 * Tolerante a fallos: nunca lanza, loggea en rp_sync_log y devuelve estado.
 */
export async function rpCancelarDelivery(
  deliveryId: number | string,
  motivo: string,
): Promise<{ ok: boolean; mensaje?: string }> {
  const dominioId = getDominioId();
  const url = `${HOST}/readonly/rest/delivery/cancelarDelivery/${dominioId}`;
  const body = {
    delivery_id: Number(deliveryId),
    delivery_motivocancelacion: motivo,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let ok = false;
  let mensaje: string | undefined;
  let responseSnapshot: unknown = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { /* not JSON */ }
    responseSnapshot = parsed ?? text.slice(0, 300);
    if (res.ok && parsed && String(parsed.tipo) === "1") {
      ok = true;
    } else {
      const msgs = parsed?.mensajes;
      mensaje = Array.isArray(msgs)
        ? msgs.flat().map((m) => String(m)).join("; ")
        : `HTTP ${res.status}`;
    }
  } catch (err) {
    mensaje = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeout);
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "cancel_pedido",
      ok,
      mensaje: ok
        ? `Delivery ${deliveryId} anulado en el POS`
        : `Fallo al anular delivery ${deliveryId}: ${mensaje ?? "desconocido"}`,
      payload: { request: body, response: responseSnapshot } as never,
    });
  } catch {
    // ignore
  }

  return ok ? { ok: true } : { ok: false, mensaje };
}


/**
 * @deprecated Reemplazado por `rpObtenerDelivery`. Shim para código viejo.
 */
export async function rpGetPedidoListByDelivery(
  deliveryId: number | string,
): Promise<{ raw: unknown; firstItem: Record<string, unknown> | null } | null> {
  const r = await rpObtenerDelivery(deliveryId);
  if (!r) return null;
  return { raw: r.raw, firstItem: r.delivery };
}

/**
 * @deprecated Antiguo; siempre null.
 */
export async function rpObtenerPedido(_pedidoId: number | string): Promise<unknown | null> {
  return null;
}

