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
const TIMEOUT_MS = 15_000;

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

// Preparado para el flujo de checkout (commits siguientes).
export async function rpRegistrarDelivery(payload: unknown): Promise<unknown> {
  const dominioId = getDominioId();
  return rpFetch<unknown>(`/delivery/registrarDelivery/${dominioId}`, {
    base: "write",
    method: "POST",
    body: JSON.stringify(payload),
  });
}
