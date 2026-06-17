// TEMPORAL — Fase A discovery endpoint. Borrar al terminar.
import { createFileRoute } from "@tanstack/react-router";

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

async function probe(path: string) {
  const url = `${HOST}${path}`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 7000);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: c.signal,
      headers: { Authorization: authHeader(), Accept: "application/json" },
    });
    const txt = await res.text();
    let raw: unknown = null;
    try { raw = txt ? JSON.parse(txt) : null; } catch {}
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const tipo = r.tipo != null ? String(r.tipo) : null;
    const mensajes = Array.isArray(r.mensajes)
      ? (r.mensajes as unknown[]).map(String).join(" | ") : null;
    const containers: Record<string, unknown>[] = [r];
    if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) containers.push(r.data as Record<string, unknown>);
    if (Array.isArray(r.data) && r.data[0] && typeof r.data[0] === "object") containers.push(r.data[0] as Record<string, unknown>);
    const hasEstado = containers.some((cc) =>
      ["delivery_estado", "estado", "delivery_estado_nombre"].some(
        (k) => cc[k] != null && String(cc[k]).trim() !== "",
      ),
    );
    return { path, status: res.status, ok: res.ok, tipo, mensajes, hasEstado, sample: txt.slice(0, 400) };
  } catch (err) {
    return { path, status: 0, ok: false, tipo: null, mensajes: null, hasEstado: false, sample: "", error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(t);
  }
}

export const Route = createFileRoute("/api/public/rp-discover")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const deliveryId = url.searchParams.get("id") || "163776";
        const dominioId = getDominioId();
        const id = encodeURIComponent(deliveryId);
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
        const results = [];
        for (const p of candidates) results.push(await probe(p));
        return new Response(JSON.stringify({ dominioId, deliveryId, results }, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
