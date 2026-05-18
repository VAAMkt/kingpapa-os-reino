// Cliente HTTP server-only para Restaurant.pe API v2.
// SERVER-ONLY: import desde createServerFn .handler() o desde *.server.ts.
// Nunca importar desde código de cliente — usa el token privado.

import type { RpEnvelope, RpDominioData, RpMenuData, RpStockData } from "@/types/restaurantpe";

const BASE_URL = "http://api.restaurant.pe/restaurant/public/v2/rest";
const TIMEOUT_MS = 15_000;

function authHeader() {
  const token = process.env.RESTAURANT_PE_TOKEN;
  if (!token) throw new Error("RESTAURANT_PE_TOKEN no configurado");
  return `Token token="${token}"`;
}

function getDominioId(): string {
  const raw = process.env.RESTAURANT_PE_DOMINIO;
  if (!raw) throw new Error("RESTAURANT_PE_DOMINIO no configurado");
  // El secret puede tener el id numérico o una URL/string; extraemos los dígitos.
  const digits = String(raw).match(/\d+/);
  if (!digits) throw new Error("RESTAURANT_PE_DOMINIO debe contener el id numérico del dominio");
  return digits[0];
}

async function rpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
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
      // tipo "1" = ok según swagger
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
  return rpFetch<RpDominioData>(`/delivery/obtenerInformacionDominio/${dominioId}?quipupos=0`);
}

/**
 * Path del catálogo/menú en Restaurant.pe (API v2).
 * Es por LOCAL, no por dominio: requiere ambos ids.
 */
const RP_CATALOGO_PATH = "/delivery/obtenerCartaPorLocal/{dominio}/{local}?quipupos=0";

export async function rpGetCatalogo(localId: string | number): Promise<RpMenuData> {
  if (localId == null || String(localId).trim() === "") {
    throw new Error("rpGetCatalogo requiere localId (rp_local_id de la sede)");
  }
  const dominioId = getDominioId();
  const path = RP_CATALOGO_PATH.replace("{dominio}", dominioId).replace(
    "{local}",
    String(localId),
  );
  return rpFetch<RpMenuData>(path);
}

export async function rpGetStock(input: {
  productoId: number;
  localId: number;
  almacenId: number;
}): Promise<RpStockData> {
  const dominioId = getDominioId();
  return rpFetch<RpStockData>(`/delivery/getStockProducto/${dominioId}?quipupos=0`, {
    method: "POST",
    body: JSON.stringify({
      producto_id: input.productoId,
      local_id: input.localId,
      almacen_id: input.almacenId,
    }),
  });
}
