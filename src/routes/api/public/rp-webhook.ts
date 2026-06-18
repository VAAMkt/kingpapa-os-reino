// Webhook público que Restaurant.pe llama cuando cambia el estado de un delivery.
// Doc oficial: Swagger V2 (2-oas3) POST /webhook
//   body: { deliveryId: number, statusCode: "0"|"2"|"3"|"4" }
//
// Configurar en Restaurant.pe: Menú → Mi Restaurant → Integraciones →
//   URI de actualización de deliverys:
//   https://kingpapa.co/api/public/rp-webhook
//
// CORRELACIÓN PROGRESIVA Y AUDITABLE (jun-2026):
// Restaurant.pe envía un `deliveryId` que NO siempre coincide con el id que
// devuelve `registrarDelivery` (lo guardamos como `orders.rp_pedido_id`).
// Para no perder estados sin nunca enlazar al pedido equivocado, resolvemos
// el match en capas:
//   1) Match directo:   orders.rp_pedido_id == deliveryId
//   2) Alias aprendido: orders.rp_response.webhook_delivery_ids @> [deliveryId]
//   3) Fallback único:  exactamente UN pedido web reciente (<=20 min desde
//                       created_at), no terminal. Si hay ≥2 → ambiguo, no toca.
// Cuando 2) ó 3) aciertan, persistimos el alias para que futuros webhooks con
// ese mismo `deliveryId` matcheen directo y queden trazables.
//
// LOG-FIRST: el body crudo siempre se guarda primero en rp_sync_log.
// FALLO SUAVE: todo error posterior responde 200 para que RP no desactive el
// webhook por errores recurrentes.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapWebhookStatusCode } from "@/lib/restaurantpe-normalize";
import type { Json } from "@/integrations/supabase/types";

const Payload = z.object({
  deliveryId: z.union([z.number(), z.string()]).transform((v) => String(v).trim()),
  statusCode: z.union([z.number(), z.string()]).transform((v) => String(v).trim()),
  tiempoEnvio: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    }),
});

const TERMINAL = new Set(["entregado", "cancelado", "error"]);
const FALLBACK_WINDOW_MS = 20 * 60_000; // 20 min desde created_at

type OrderLite = {
  id: string;
  status: string;
  cancel_reason: string | null;
  rp_response: unknown;
  rp_pedido_id: string | null;
  created_at: string;
};

function pickHeaders(request: Request): Record<string, string> {
  const keep = [
    "user-agent",
    "content-type",
    "content-length",
    "host",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "cf-connecting-ip",
    "cf-ipcountry",
    "x-real-ip",
  ];
  const out: Record<string, string> = {};
  for (const k of keep) {
    const v = request.headers.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function getSourceIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

type MatchResult =
  | { kind: "direct"; order: OrderLite }
  | { kind: "alias"; order: OrderLite }
  | { kind: "fallback_single"; order: OrderLite; candidatesCount: 1 }
  | { kind: "ambiguous"; candidates: Array<Pick<OrderLite, "id" | "rp_pedido_id" | "status" | "created_at">> }
  | { kind: "none"; candidates: Array<Pick<OrderLite, "id" | "rp_pedido_id" | "status" | "created_at">> };

async function resolveOrderForDelivery(deliveryId: string): Promise<MatchResult> {
  // 1) Match directo.
  const direct = await supabaseAdmin
    .from("orders")
    .select("id, status, cancel_reason, rp_response, rp_pedido_id, created_at")
    .eq("rp_pedido_id", deliveryId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (direct.data && direct.data.length > 0) {
    return { kind: "direct", order: direct.data[0] as OrderLite };
  }

  // 2) Alias aprendido (rp_response.webhook_delivery_ids @> [deliveryId]).
  const alias = await supabaseAdmin
    .from("orders")
    .select("id, status, cancel_reason, rp_response, rp_pedido_id, created_at")
    .contains("rp_response", { webhook_delivery_ids: [deliveryId] } as never)
    .order("created_at", { ascending: false })
    .limit(1);
  if (alias.data && alias.data.length > 0) {
    return { kind: "alias", order: alias.data[0] as OrderLite };
  }

  // 3) Fallback por candidato único reciente no terminal (web == todos los nuestros).
  const sinceIso = new Date(Date.now() - FALLBACK_WINDOW_MS).toISOString();
  const cand = await supabaseAdmin
    .from("orders")
    .select("id, status, cancel_reason, rp_response, rp_pedido_id, created_at")
    .in("status", ["enviado", "recibido", "en_preparacion", "en_camino"])
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(5);
  const candidates = (cand.data ?? []) as OrderLite[];
  if (candidates.length === 1) {
    return { kind: "fallback_single", order: candidates[0], candidatesCount: 1 };
  }
  const lite = candidates.map((c) => ({
    id: c.id,
    rp_pedido_id: c.rp_pedido_id,
    status: c.status,
    created_at: c.created_at,
  }));
  if (candidates.length > 1) return { kind: "ambiguous", candidates: lite };
  return { kind: "none", candidates: lite };
}

async function handleWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // 1) LOG CRUDO INMEDIATO.
  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    bodyText = "";
  }
  const sourceIp = getSourceIp(request);
  const headersSubset = pickHeaders(request);
  const bodyEmpty = bodyText.length === 0;

  await supabaseAdmin.from("rp_sync_log").insert({
    tipo: "webhook_raw",
    ok: true,
    mensaje: bodyEmpty ? "POST recibido (body vacío)" : "POST recibido",
    payload: {
      raw: bodyText,
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      search: url.search,
      host: url.host,
      source_ip: sourceIp,
      headers: headersSubset,
    } as unknown as Json,
  });

  // 2) Parseo. A partir de aquí, todo error → 200 (fallo suave).
  let parsed: z.infer<typeof Payload>;
  try {
    parsed = Payload.parse(JSON.parse(bodyText));
  } catch (err) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: false,
      mensaje: `payload inválido: ${err instanceof Error ? err.message : String(err)}`,
      payload: { raw: bodyText } as unknown as Json,
    });
    return new Response("ok", { status: 200 });
  }

  const mapped = mapWebhookStatusCode(parsed.statusCode);
  if (!mapped) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: false,
      mensaje: `statusCode desconocido: ${parsed.statusCode}`,
      payload: parsed as unknown as Json,
    });
    return new Response("ok", { status: 200 });
  }

  // 3) Resolver pedido (correlación progresiva).
  const match = await resolveOrderForDelivery(parsed.deliveryId);

  if (match.kind === "ambiguous") {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook_ambiguous",
      ok: false,
      mensaje: `Webhook ambiguo (deliveryId=${parsed.deliveryId}, sc=${parsed.statusCode} → ${mapped}). ${match.candidates.length} candidatos recientes; no se actualizó ningún pedido.`,
      payload: { ...parsed, candidatos: match.candidates } as unknown as Json,
    });
    return new Response("ok", { status: 200 });
  }

  if (match.kind === "none") {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook_ignored_external",
      ok: true,
      mensaje: `Pedido externo ignorado (deliveryId=${parsed.deliveryId}, sc=${parsed.statusCode} → ${mapped}). Sin candidatos web recientes.`,
      payload: { ...parsed, candidatos: match.candidates } as unknown as Json,
    });
    return new Response("ok", { status: 200 });
  }

  const row = match.order;
  const linkReason: "direct" | "alias" | "fallback_single" = match.kind;

  // 4) No-op si ya está en ese estado o terminal.
  if (row.status === mapped || TERMINAL.has(row.status)) {
    // Aún así, si vino por fallback/alias, dejamos el alias persistido para
    // que los próximos eventos matcheen directo.
    if (linkReason !== "direct") {
      await persistAlias(row, parsed.deliveryId, linkReason, mapped);
    }
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: true,
      mensaje: `no-op (status=${row.status}, recibido=${mapped}, via=${linkReason})`,
      payload: { ...parsed, order_id: row.id, via: linkReason } as unknown as Json,
    });
    return new Response("ok", { status: 200 });
  }

  // 5) Construir update.
  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = { status: mapped };
  if (mapped === "cancelado" && !row.cancel_reason) {
    updates.cancel_reason = "Cancelado desde el POS";
    updates.cancelled_at = nowIso;
  }

  // Merge de rp_response: alias + ETA + status_history.
  const prev = asObject(row.rp_response);
  const existingIds = Array.isArray(prev.webhook_delivery_ids)
    ? (prev.webhook_delivery_ids as unknown[]).map(String)
    : [];
  const idsSet = new Set(existingIds);
  idsSet.add(parsed.deliveryId);
  const history = Array.isArray(prev.webhook_status_history)
    ? (prev.webhook_status_history as unknown[]).slice(-19)
    : [];
  history.push({
    at: nowIso,
    delivery_id: parsed.deliveryId,
    status_code: parsed.statusCode,
    mapped,
    eta_min: parsed.tiempoEnvio,
    via: linkReason,
  });

  const nextRp: Record<string, unknown> = {
    ...prev,
    webhook_delivery_ids: Array.from(idsSet),
    webhook_first_seen_at: prev.webhook_first_seen_at ?? nowIso,
    webhook_last_seen_at: nowIso,
    webhook_link_reason: linkReason,
    webhook_status_history: history,
  };
  if (mapped === "en_camino" && parsed.tiempoEnvio != null) {
    nextRp.eta_min = parsed.tiempoEnvio;
    nextRp.eta_set_at = nowIso;
  }
  updates.rp_response = nextRp;

  const { error: updErr } = await supabaseAdmin
    .from("orders")
    .update(updates as never)
    .eq("id", row.id);

  if (updErr) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: false,
      mensaje: `update falló: ${updErr.message}`,
      payload: { ...parsed, order_id: row.id, via: linkReason } as unknown as Json,
    });
    return new Response("ok", { status: 200 });
  }

  // 6) Log auditable según ruta de match.
  const etaSuffix =
    mapped === "en_camino" && parsed.tiempoEnvio != null
      ? ` (ETA ${parsed.tiempoEnvio} min)`
      : "";

  if (linkReason === "fallback_single") {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook_linked_fallback",
      ok: true,
      mensaje: `Vinculado por candidato único: ${row.status} → ${mapped}${etaSuffix} (deliveryId=${parsed.deliveryId} ↔ order ${row.id.slice(0, 8)}, rp_pedido_id=${row.rp_pedido_id ?? "n/d"})`,
      payload: { ...parsed, order_id: row.id, via: linkReason } as unknown as Json,
    });
  } else if (linkReason === "alias") {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook_alias_learned",
      ok: true,
      mensaje: `Match por alias aprendido: ${row.status} → ${mapped}${etaSuffix} (deliveryId=${parsed.deliveryId})`,
      payload: { ...parsed, order_id: row.id, via: linkReason } as unknown as Json,
    });
  } else {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: true,
      mensaje: `${row.status} → ${mapped}${etaSuffix}`,
      payload: { ...parsed, order_id: row.id, via: linkReason } as unknown as Json,
    });
  }

  return new Response("ok", { status: 200 });
}

/**
 * Persiste alias en rp_response cuando el match no fue directo y el update
 * principal no corre (no-op por mismo status o terminal). Garantiza que el
 * siguiente webhook con ese deliveryId matchee por alias.
 */
async function persistAlias(
  row: OrderLite,
  deliveryId: string,
  linkReason: "alias" | "fallback_single",
  mapped: string,
): Promise<void> {
  const prev = asObject(row.rp_response);
  const existingIds = Array.isArray(prev.webhook_delivery_ids)
    ? (prev.webhook_delivery_ids as unknown[]).map(String)
    : [];
  if (existingIds.includes(deliveryId)) return;
  const nowIso = new Date().toISOString();
  const nextRp: Record<string, unknown> = {
    ...prev,
    webhook_delivery_ids: [...existingIds, deliveryId],
    webhook_first_seen_at: prev.webhook_first_seen_at ?? nowIso,
    webhook_last_seen_at: nowIso,
    webhook_link_reason: linkReason,
  };
  await supabaseAdmin
    .from("orders")
    .update({ rp_response: nextRp } as never)
    .eq("id", row.id);
  await supabaseAdmin.from("rp_sync_log").insert({
    tipo: "webhook_alias_learned",
    ok: true,
    mensaje: `Alias aprendido en no-op (deliveryId=${deliveryId} ↔ order ${row.id.slice(0, 8)}, status=${row.status}, recibido=${mapped})`,
    payload: { order_id: row.id, delivery_id: deliveryId, via: linkReason } as unknown as Json,
  });
}

export const Route = createFileRoute("/api/public/rp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleWebhook(request),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t");
        if (!token || token !== process.env.RP_WEBHOOK_SECRET) {
          return new Response("unauthorized", { status: 401 });
        }
        return Response.json({ ok: true, hint: "POST { deliveryId, statusCode }" });
      },
    },
  },
});
