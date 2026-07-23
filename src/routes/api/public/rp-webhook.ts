// Webhook público que Restaurant.pe llama cuando cambia el estado de un delivery.
// Doc oficial: Swagger V2 (2-oas3) POST /webhook
//   body: { deliveryId: number, statusCode: "0"|"2"|"3"|"4", tiempoEnvio?: number,
//           delivery_codigointegracion?: string (UUID local) }
//
// Configurar en Restaurant.pe: Menú → Mi Restaurant → Integraciones →
//   URI de actualización de deliverys:
//   https://kingpapa.co/api/public/rp-webhook
//
// CORRELACIÓN ESTRICTA (v3 — jun-2026):
// SÓLO matcheamos webhooks a pedidos por identidad fuerte. NUNCA por
// proximidad temporal ("el único pedido reciente"). RP envía a esta URL
// webhooks de OTROS deliveries de la cuenta, y un fallback laxo termina
// secuestrando pedidos ajenos.
//   1) integration → `delivery_codigointegracion` == orders.id (UUID local
//                    que enviamos en registrarDelivery). Llave canónica.
//   2) direct      → orders.rp_pedido_id == deliveryId.
//   3) alias       → orders.rp_response.webhook_delivery_ids @> [deliveryId],
//                    pero el alias SOLO se aprende cuando el match original
//                    fue integration o direct. Nunca desde fallback.
// Si nada matchea → log `webhook_ignored_external` y 200. Mejor no tocar
// nada que marcar un pedido al azar como entregado.
//
// ANTI-REGRESIÓN: ranking de estados (enviado<recibido<en_camino<entregado)
// descarta eventos atrasados o reintentos fuera de orden.
//
// LOG-FIRST: el body crudo siempre se guarda primero en rp_sync_log.
// FALLO SUAVE: todo error posterior responde 200 para que RP no desactive
// el webhook por errores recurrentes.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapWebhookStatusCode } from "@/lib/restaurantpe-normalize";
import type { Json } from "@/integrations/supabase/types";

const TERMINAL = new Set(["entregado", "cancelado", "error"]);
const FALLBACK_WINDOW_MS = 20 * 60_000; // (legacy) ya no se usa para matchear
const INTEGRATION_WINDOW_MS = 3 * 60 * 60_000; // 3 h desde created_at

// Ranking para detectar regresiones (cancelado/error fuera de progresión).
const STATUS_RANK: Record<string, number> = {
  enviado: 0,
  recibido: 1,
  en_preparacion: 2,
  en_camino: 3,
  entregado: 4,
  cancelado: 99,
  error: 99,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderLite = {
  id: string;
  status: string;
  cancel_reason: string | null;
  rp_response: unknown;
  rp_pedido_id: string | null;
  created_at: string;
};

type ParsedPayload = {
  deliveryId: string;
  statusCode: string;
  tiempoEnvio: number | null;
  integrationCode: string | null;
  raw: unknown;
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
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function pickFirst(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return null;
}

/**
 * Parser tolerante. Acepta JSON o form-urlencoded.
 * IMPORTANTE: no aceptamos `delivery_estado` ni `estado` aquí — esos campos
 * tienen semánticas distintas (mapper diferente). Si en el futuro RP los
 * envía por webhook, habrá que añadir `statusSource` + mapper separado.
 */
function parseWebhookPayload(bodyText: string): ParsedPayload | null {
  if (!bodyText) return null;
  let raw: Record<string, unknown> | null = null;
  try {
    const j = JSON.parse(bodyText);
    if (j && typeof j === "object" && !Array.isArray(j)) {
      raw = j as Record<string, unknown>;
    }
  } catch {
    // Probar form-urlencoded.
    try {
      const params = new URLSearchParams(bodyText);
      const obj: Record<string, unknown> = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      if (Object.keys(obj).length > 0) raw = obj;
    } catch {
      // ignore
    }
  }
  if (!raw) return null;

  const deliveryId = pickFirst(raw, ["deliveryId", "delivery_id", "deliveryid", "id"]);
  const statusCode = pickFirst(raw, ["statusCode", "status_code"]);
  const tiempoEnvioRaw = pickFirst(raw, ["tiempoEnvio", "tiempo_envio", "eta", "eta_min"]);
  const integrationCode = pickFirst(raw, [
    "delivery_codigointegracion",
    "codigoIntegracion",
    "codigo_integracion",
    "codigointegracion",
    "integration_code",
    "integrationCode",
    "external_id",
    "order_id",
  ]);

  if (!deliveryId || !statusCode) return null;

  let tiempoEnvio: number | null = null;
  if (tiempoEnvioRaw != null) {
    const n = Number(tiempoEnvioRaw);
    if (Number.isFinite(n) && n > 0) tiempoEnvio = n;
  }

  return { deliveryId, statusCode, tiempoEnvio, integrationCode, raw };
}

type MatchResult =
  | { kind: "integration"; order: OrderLite }
  | { kind: "direct"; order: OrderLite }
  | { kind: "alias"; order: OrderLite }
  | { kind: "none" };

async function resolveByIntegrationCode(integrationCode: string): Promise<OrderLite | null> {
  if (!UUID_RE.test(integrationCode)) return null;
  const sinceIso = new Date(Date.now() - INTEGRATION_WINDOW_MS).toISOString();
  const r = await supabaseAdmin
    .from("orders")
    .select("id, status, cancel_reason, rp_response, rp_pedido_id, created_at")
    .eq("id", integrationCode)
    .in("status", ["enviado", "recibido", "en_preparacion", "en_camino"])
    .gte("created_at", sinceIso)
    .not("rp_response", "is", null)
    .maybeSingle();
  if (r.error || !r.data) return null;
  return r.data as OrderLite;
}

async function resolveOrderForWebhook(
  deliveryId: string,
  integrationCode: string | null,
): Promise<MatchResult> {
  // 1) Match canónico por integrationCode (UUID que enviamos en registrarDelivery).
  if (integrationCode) {
    const o = await resolveByIntegrationCode(integrationCode);
    if (o) return { kind: "integration", order: o };
  }

  // 2) Match directo por rp_pedido_id == deliveryId.
  const direct = await supabaseAdmin
    .from("orders")
    .select("id, status, cancel_reason, rp_response, rp_pedido_id, created_at")
    .eq("rp_pedido_id", deliveryId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (direct.data && direct.data.length > 0) {
    return { kind: "direct", order: direct.data[0] as OrderLite };
  }

  // 3) Alias aprendido (sólo se aprende desde integration/direct — ver
  //    persistAlias). Ventana 3h + no terminal por seguridad extra.
  const aliasSinceIso = new Date(Date.now() - INTEGRATION_WINDOW_MS).toISOString();
  const alias = await supabaseAdmin
    .from("orders")
    .select("id, status, cancel_reason, rp_response, rp_pedido_id, created_at")
    .contains("rp_response", { webhook_delivery_ids: [deliveryId] } as never)
    .in("status", ["enviado", "recibido", "en_preparacion", "en_camino"])
    .gte("created_at", aliasSinceIso)
    .order("created_at", { ascending: false })
    .limit(1);
  if (alias.data && alias.data.length > 0) {
    return { kind: "alias", order: alias.data[0] as OrderLite };
  }

  // Sin match fuerte → no tocamos nada. Mejor ignorar que vincular al azar.
  return { kind: "none" };
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

  // 2) Parseo tolerante. A partir de aquí, todo error → 200 (fallo suave).
  const parsed = parseWebhookPayload(bodyText);
  if (!parsed) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: false,
      mensaje: "payload inválido (no JSON ni form-urlencoded reconocible)",
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

  // 3) Resolver pedido (correlación progresiva, prioriza integrationCode).
  const match = await resolveOrderForWebhook(parsed.deliveryId, parsed.integrationCode);

  if (match.kind === "none") {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook_ignored_external",
      ok: true,
      mensaje: `Webhook ignorado (deliveryId=${parsed.deliveryId}, sc=${parsed.statusCode} → ${mapped}). Sin match fuerte (integration/direct/alias).`,
      payload: parsed as unknown as Json,
    });
    return new Response("ok", { status: 200 });
  }

  const row = match.order;
  const linkReason: "integration" | "direct" | "alias" = match.kind;

  // 4) No-op si ya está en ese estado o terminal.
  if (row.status === mapped || TERMINAL.has(row.status)) {
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

  // 4.5) Anti-regresión: ignorar eventos que retrocederían la progresión.
  // Cancelado/error tienen rank 99 — siempre pueden aplicarse (excepto si ya
  // están en terminal, cubierto arriba).
  const currentRank = STATUS_RANK[row.status] ?? 0;
  const nextRank = STATUS_RANK[mapped] ?? 0;
  if (mapped !== "cancelado" && mapped !== "error" && nextRank < currentRank) {
    if (linkReason !== "direct") {
      await persistAlias(row, parsed.deliveryId, linkReason, mapped);
    }
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook_regression_ignored",
      ok: true,
      mensaje: `Regresión ignorada: ${row.status} (rank ${currentRank}) → ${mapped} (rank ${nextRank}) via=${linkReason}`,
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
    integration_code: parsed.integrationCode,
  });

  const nextRp: Record<string, unknown> = {
    ...prev,
    webhook_delivery_ids: Array.from(idsSet),
    webhook_first_seen_at: prev.webhook_first_seen_at ?? nowIso,
    webhook_last_seen_at: nowIso,
    webhook_link_reason: linkReason,
    webhook_status_history: history,
  };
  if (parsed.integrationCode) {
    nextRp.webhook_integration_code = parsed.integrationCode;
  }
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
    mapped === "en_camino" && parsed.tiempoEnvio != null ? ` (ETA ${parsed.tiempoEnvio} min)` : "";

  if (linkReason === "integration") {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook_linked_integration",
      ok: true,
      mensaje: `Match por integrationCode: ${row.status} → ${mapped}${etaSuffix} (deliveryId=${parsed.deliveryId} ↔ order ${row.id.slice(0, 8)})`,
      payload: { ...parsed, order_id: row.id, via: linkReason } as unknown as Json,
    });
  } else if (linkReason === "direct") {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: true,
      mensaje: `Match directo: ${row.status} → ${mapped}${etaSuffix} (deliveryId=${parsed.deliveryId} ↔ order ${row.id.slice(0, 8)})`,
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
  linkReason: "integration" | "alias",
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
      // GET público mínimo — Restaurant.pe puede validar la URL con un GET
      // simple. No exponemos datos sensibles.
      GET: async () => Response.json({ ok: true, service: "kingpapa-rp-webhook" }),
    },
  },
});
