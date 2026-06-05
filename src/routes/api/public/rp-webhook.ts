// Webhook público que Restaurant.pe llama cuando cambia el estado de un delivery.
// Doc oficial: Swagger V2 (2-oas3) POST /webhook
//   body: { deliveryId: number, statusCode: "0"|"2"|"3"|"4" }
//
// Configurar en Restaurant.pe: Menú → Mi Restaurant → Integraciones →
//   URI de actualización de deliverys:
//   https://<host>/api/public/rp-webhook?t=<RP_WEBHOOK_SECRET>
//
// Diseño:
//  - LOG-FIRST: el primer paso siempre es guardar el body crudo + IP + headers
//    en rp_sync_log (tipo='webhook_raw'). Así verificamos empíricamente qué
//    envía RP (incluidas cancelaciones desde el POS) sin depender de validación.
//  - FALLO SUAVE: tras el log crudo, cualquier error posterior (JSON inválido,
//    statusCode desconocido, pedido no encontrado, update fallido) responde
//    HTTP 200 para evitar que RP desactive el webhook por errores recurrentes.
//    Solo el token inválido devuelve 401.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapWebhookStatusCode } from "@/lib/restaurantpe-normalize";
import type { Json } from "@/integrations/supabase/types";

const Payload = z.object({
  deliveryId: z.union([z.number(), z.string()]).transform((v) => String(v).trim()),
  statusCode: z.union([z.number(), z.string()]).transform((v) => String(v).trim()),
  // Doc oficial OAS3 (30/07/2024) no lo lista, pero RP lo envía en webhooks
  // recientes con statusCode=3. Es el ETA en minutos.
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

async function handleWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  const expected = process.env.RP_WEBHOOK_SECRET;

  // 1) LOG CRUDO INMEDIATO — antes de cualquier validación/parsing.
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
      query_token_present: Boolean(token),
      query_token_match: Boolean(expected && token === expected),
    } as unknown as Json,
  });

  // 2) Token: único caso donde devolvemos error HTTP real.
  if (!expected || !token || token !== expected) {
    // Detección defensiva: si Restaurant.pe (o el usuario al pegar la URL)
    // dejó los corchetes `<...>` del placeholder, el token llega URL-encoded
    // como `%3C...%3E` y nunca matchea. Logueamos explícitamente para que
    // se vea en /admin/pedidos sin tener que descodificar a mano.
    const trimmed = token ? token.replace(/^[<%3Ce]*/i, "").replace(/[>%3Ee]*$/i, "").trim() : "";
    const looksBracketed = !!token && (/^<.*>$/.test(token) || /^%3C.*%3E$/i.test(token));
    const matchesIfStripped = !!expected && !!trimmed && trimmed === expected;
    if (looksBracketed || matchesIfStripped) {
      await supabaseAdmin.from("rp_sync_log").insert({
        tipo: "webhook",
        ok: false,
        mensaje:
          "Token con corchetes <...> — corregir URI en Restaurant.pe (quitar < y >).",
        payload: {
          token_received: token,
          url: request.url,
        } as unknown as Json,
      });
    }
    return new Response("unauthorized", { status: 401 });
  }

  // 3) Parseo. A partir de aquí, todo error → 200 (fallo suave).
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

  // Match por rp_pedido_id (registrarDelivery devuelve este id como `data`).
  const { data: rows, error: selErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, cancel_reason, rp_response")
    .eq("rp_pedido_id", parsed.deliveryId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (selErr || !rows || rows.length === 0) {
    // Enriquecer el log con candidatos: últimos pedidos vivos sin match.
    const sinceIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: candidatos } = await supabaseAdmin
      .from("orders")
      .select("id, rp_pedido_id, rp_numero_comanda, status, created_at")
      .in("status", ["enviado", "recibido", "en_preparacion", "en_camino"])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5);
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: false,
      mensaje: `pedido no encontrado para deliveryId=${parsed.deliveryId} (sc=${parsed.statusCode} → ${mapped})`,
      payload: {
        ...parsed,
        candidatos: candidatos ?? [],
        select_error: selErr?.message ?? null,
      } as unknown as Json,
    });
    return new Response("ok", { status: 200 });
  }

  const row = rows[0];
  if (row.status === mapped || TERMINAL.has(row.status)) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: true,
      mensaje: `no-op (status=${row.status}, recibido=${mapped})`,
      payload: { ...parsed, order_id: row.id } as unknown as Json,
    });
    return new Response("ok", { status: 200 });
  }

  const updates: Record<string, unknown> = { status: mapped };
  if (mapped === "cancelado" && !row.cancel_reason) {
    updates.cancel_reason = "Cancelado desde el POS";
    updates.cancelled_at = new Date().toISOString();
  }
  // Persistir ETA cuando RP lo manda en sc=3 ("en camino").
  if (mapped === "en_camino" && parsed.tiempoEnvio != null) {
    const prev = (row.rp_response ?? {}) as Record<string, unknown>;
    updates.rp_response = {
      ...prev,
      eta_min: parsed.tiempoEnvio,
      eta_set_at: new Date().toISOString(),
    };
  }

  const { error: updErr } = await supabaseAdmin
    .from("orders")
    .update(updates as never)
    .eq("id", row.id);

  if (updErr) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: false,
      mensaje: `update falló: ${updErr.message}`,
      payload: { ...parsed, order_id: row.id } as unknown as Json,
    });
    // Fallo suave: 200 igual.
    return new Response("ok", { status: 200 });
  }

  const etaSuffix =
    mapped === "en_camino" && parsed.tiempoEnvio != null
      ? ` (ETA ${parsed.tiempoEnvio} min)`
      : "";
  await supabaseAdmin.from("rp_sync_log").insert({
    tipo: "webhook",
    ok: true,
    mensaje: `${row.status} → ${mapped}${etaSuffix}`,
    payload: { ...parsed, order_id: row.id } as unknown as Json,
  });

  return new Response("ok", { status: 200 });
}

export const Route = createFileRoute("/api/public/rp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleWebhook(request),
      // Algunas integraciones envían GET con query params para probar el endpoint.
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
