// Webhook público que Restaurant.pe llama cuando cambia el estado de un delivery.
// Doc oficial: Swagger V2 (2-oas3) POST /webhook
//   body: { deliveryId: number, statusCode: "0"|"2"|"3"|"4" }
//
// Configurar en Restaurant.pe: Menú → Mi Restaurant → Integraciones →
//   URI de actualización de deliverys:
//   https://<host>/api/public/rp-webhook?t=<RP_WEBHOOK_SECRET>
//
// Seguridad: token compartido en query string. El endpoint solo UPDATEa
// `orders` filtrando por `rp_pedido_id`; no devuelve PII.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapWebhookStatusCode } from "@/lib/restaurantpe-normalize";
import type { Json } from "@/integrations/supabase/types";

const Payload = z.object({
  deliveryId: z.union([z.number(), z.string()]).transform((v) => String(v).trim()),
  statusCode: z.union([z.number(), z.string()]).transform((v) => String(v).trim()),
});

const TERMINAL = new Set(["entregado", "cancelado", "error"]);

async function handleWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  const expected = process.env.RP_WEBHOOK_SECRET;
  if (!expected || !token || token !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  let bodyText = "";
  let parsed: z.infer<typeof Payload>;
  try {
    bodyText = await request.text();
    parsed = Payload.parse(JSON.parse(bodyText));
  } catch (err) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: false,
      mensaje: `payload inválido: ${err instanceof Error ? err.message : String(err)}`,
      payload: { raw: bodyText } as unknown as Json,
    });
    return new Response("bad request", { status: 400 });
  }

  const mapped = mapWebhookStatusCode(parsed.statusCode);
  if (!mapped) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: false,
      mensaje: `statusCode desconocido: ${parsed.statusCode}`,
      payload: parsed as unknown as Json,
    });
    return new Response("unknown statusCode", { status: 422 });
  }

  // Match por rp_pedido_id (registrarDelivery devuelve este id como `data`).
  const { data: rows, error: selErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, cancel_reason")
    .eq("rp_pedido_id", parsed.deliveryId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (selErr || !rows || rows.length === 0) {
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "webhook",
      ok: false,
      mensaje: `pedido no encontrado para deliveryId=${parsed.deliveryId}`,
      payload: parsed as unknown as Json,
    });
    // 200 para que Restaurant.pe no reintente eternamente.
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
    return new Response("update failed", { status: 500 });
  }

  await supabaseAdmin.from("rp_sync_log").insert({
    tipo: "webhook",
    ok: true,
    mensaje: `${row.status} → ${mapped}`,
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
