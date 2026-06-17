// TEMPORAL — Fase A: discovery de endpoints GET en api.restaurant.pe
// que devuelvan estado de delivery/pedido usando RESTAURANT_PE_TOKEN.
// Borrar al terminar la decisión Fase B.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HOST = "http://api.restaurant.pe/restaurant";

function authHeader() {
  const token = process.env.RESTAURANT_PE_TOKEN;
  if (!token) throw new Error("RESTAURANT_PE_TOKEN no configurado");
  return `Token token="${token}"`;
}

function getDominioId(): string {
  const raw = process.env.RESTAURANT_PE_DOMINIO;
  if (!raw) throw new Error("RESTAURANT_PE_DOMINIO no configurado");
  const m = String(raw).match(/\d+/);
  if (!m) throw new Error("RESTAURANT_PE_DOMINIO inválido");
  return m[0];
}

type ProbeResult = {
  path: string;
  status: number;
  ok: boolean;
  tipo: string | null;
  mensajes: string | null;
  hasEstado: boolean;
  sample: string;
  error: string | null;
};

async function probe(path: string): Promise<ProbeResult> {
  const url = `${HOST}${path}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 7_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
      },
    });
    let raw: unknown = null;
    let textSample = "";
    try {
      const txt = await res.text();
      textSample = txt.slice(0, 400);
      raw = txt ? JSON.parse(txt) : null;
    } catch {
      raw = null;
    }
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const tipo = r.tipo != null ? String(r.tipo) : null;
    const mensajes = Array.isArray(r.mensajes)
      ? (r.mensajes as unknown[]).map(String).join(" | ")
      : null;
    // ¿Algún campo de estado conocido en raw, raw.data o raw.data[0]?
    const containers: Record<string, unknown>[] = [];
    containers.push(r);
    if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) {
      containers.push(r.data as Record<string, unknown>);
    }
    if (Array.isArray(r.data) && r.data[0] && typeof r.data[0] === "object") {
      containers.push(r.data[0] as Record<string, unknown>);
    }
    const hasEstado = containers.some((c) =>
      ["delivery_estado", "estado", "delivery_estado_nombre"].some(
        (k) => c[k] != null && String(c[k]).trim() !== "",
      ),
    );
    return {
      path,
      status: res.status,
      ok: res.ok,
      tipo,
      mensajes,
      hasEstado,
      sample: textSample,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      path,
      status: 0,
      ok: false,
      tipo: null,
      mensajes: null,
      hasEstado: false,
      sample: "",
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(t);
  }
}

export const rpDiscoverDelivery = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ deliveryId: z.union([z.string(), z.number()]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const dominioId = getDominioId();
    const id = encodeURIComponent(String(data.deliveryId));
    const candidates = [
      `/readonly/rest/delivery/get/${dominioId}/${id}`,
      `/readonly/rest/delivery/get/${id}`,
      `/readonly/rest/delivery/obtenerSyncFull/${dominioId}/${id}`,
      `/readonly/rest/delivery/obtenerSyncFull/${id}`,
      `/readonly/rest/delivery/obtenerDelivery/${dominioId}/${id}/0`,
      `/readonly/rest/delivery/obtenerDelivery/${id}/0`,
      `/readonly/rest/delivery/obtenerPedido/${dominioId}/${id}`,
      `/public/v2/rest/delivery/get/${dominioId}/${id}`,
      `/public/v2/rest/delivery/obtenerSyncFull/${dominioId}/${id}`,
      `/public/v2/rest/delivery/obtenerDelivery/${dominioId}/${id}/0`,
      `/public/v2/rest/delivery/obtenerPedido/${dominioId}/${id}`,
    ];
    const results: ProbeResult[] = [];
    for (const p of candidates) {
      results.push(await probe(p));
    }
    return { dominioId, deliveryId: String(data.deliveryId), results };
  });
