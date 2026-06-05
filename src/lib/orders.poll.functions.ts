// Resolver de ID de pedido + polling de guerrilla contra el POS interno
// de Restaurant.pe. Server-only.
//
// Arquitectura híbrida (junio 2026):
//  - Webhook + Supabase Realtime es el camino principal y maestro.
//  - El polling es un SALVAVIDAS por dos motivos:
//      1) extraer el `rp_numero_comanda` (que el webhook nunca manda)
//         para que la UI deje de decir "Asignando comanda…".
//      2) avanzar el `status` si el webhook se perdió un evento.
//  - Endpoint usado (interno del POS, no documentado):
//      http://<sub>.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/{deliveryId}
//    Auth: cookie de sesión copiada del navegador (RESTAURANT_PE_POS_TOKEN).
//  - Si el token expira o no está configurado, la función debe FALLAR SUAVE:
//    devolver `{ ok: false, soft: true }` y dejar que la app siga viviendo
//    100% reactiva sobre el webhook.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSubdominio } from "@/lib/restaurantpe.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resuelve el id de pedido aceptando UUID o `rp_pedido_id` numérico.
 * Devuelve el UUID real de `orders.id` (necesario para Realtime).
 */
export const resolveOrderId = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ ref: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const ref = data.ref.trim();
    if (UUID_RE.test(ref)) {
      const { data: row } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("id", ref)
        .maybeSingle();
      return row ? { id: row.id } : { notFound: true as const };
    }
    const { data: rows } = await supabaseAdmin
      .from("orders")
      .select("id, created_at")
      .eq("rp_pedido_id", ref)
      .order("created_at", { ascending: false })
      .limit(1);
    if (rows && rows.length > 0) return { id: rows[0].id };
    return { notFound: true as const };
  });

// Mapa de estados del endpoint INTERNO del POS (distinto al webhook).
//   1 = recibido, 2 = en_preparacion, 3 = en_camino, 4 = cancelado, 5 = entregado
type OrderStatus =
  | "enviado"
  | "recibido"
  | "en_preparacion"
  | "en_camino"
  | "entregado"
  | "cancelado"
  | "error";

function mapPosEstado(estado: unknown): OrderStatus | null {
  if (estado == null || estado === "") return null;
  const n = Number(estado);
  if (!Number.isFinite(n)) return null;
  switch (Math.trunc(n)) {
    case 1:
      return "recibido";
    case 2:
      return "en_preparacion";
    case 3:
      return "en_camino";
    case 4:
      return "cancelado";
    case 5:
      return "entregado";
    default:
      return null;
  }
}

// Orden lineal de avance — el polling sólo PROMUEVE, nunca retrocede.
const STATUS_RANK: Record<OrderStatus, number> = {
  enviado: 0,
  recibido: 1,
  en_preparacion: 2,
  en_camino: 3,
  entregado: 4,
  cancelado: 5, // terminal pero válido si llega
  error: 5,
};

/**
 * Polling de guerrilla: pega al endpoint interno del POS de Restaurant.pe
 * para extraer `rp_numero_comanda` y, opcionalmente, avanzar el status si
 * el webhook se perdió un evento.
 *
 * Diseño: SIEMPRE soft-fail. Nunca lanza. Nunca bloquea al cliente.
 */
export const pollOrderFromRp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ orderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const cookie = process.env.RESTAURANT_PE_POS_TOKEN;
    if (!cookie) {
      return { ok: false as const, soft: true, reason: "pos_token_missing" };
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, rp_pedido_id, rp_numero_comanda")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || !order.rp_pedido_id) {
      return { ok: false as const, soft: true, reason: "no_rp_pedido_id" };
    }

    const sub = getSubdominio();
    const url = `http://${sub}.restaurant.pe/restaurant/api/rest/pedido/getPedidoListByDelivery/${encodeURIComponent(order.rp_pedido_id)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    let json: { tipo?: string | number; data?: unknown } | null = null;
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Cookie: cookie,
          "User-Agent": "Mozilla/5.0 KingPapaWeb/1.0",
        },
      });
      if (!res.ok) {
        return { ok: false as const, soft: true, reason: `http_${res.status}` };
      }
      json = (await res.json()) as { tipo?: string | number; data?: unknown };
    } catch {
      return { ok: false as const, soft: true, reason: "fetch_failed" };
    } finally {
      clearTimeout(timer);
    }

    if (!json || String(json.tipo) !== "1") {
      return { ok: false as const, soft: true, reason: "tipo_no_ok" };
    }
    const arr = Array.isArray(json.data) ? json.data : [];
    if (arr.length === 0) {
      return { ok: false as const, soft: true, reason: "empty_data" };
    }

    const first = arr[0] as Record<string, unknown>;
    const estadoNuevo = mapPosEstado(first.pedido_estado);

    // Comanda con fallback inteligente: comandaid → pedido_id.
    let comandaRaw =
      first.pedido_comandaid != null && String(first.pedido_comandaid).trim() !== ""
        ? String(first.pedido_comandaid).trim()
        : null;
    if (!comandaRaw) {
      const pid = first.pedido_id;
      if (pid != null && String(pid).trim() !== "") comandaRaw = String(pid).trim();
    }

    const updates: Record<string, unknown> = {};

    // 1) Comanda — sólo si no la tenemos aún.
    if (comandaRaw && !order.rp_numero_comanda) {
      updates.rp_numero_comanda = comandaRaw;
    }

    // 2) Status — sólo si AVANZA (el webhook es el maestro).
    if (estadoNuevo) {
      const current = (order.status as OrderStatus) ?? "enviado";
      const isTerminal = current === "entregado" || current === "cancelado" || current === "error";
      if (!isTerminal && STATUS_RANK[estadoNuevo] > STATUS_RANK[current]) {
        updates.status = estadoNuevo;
      }
    }

    if (Object.keys(updates).length === 0) {
      return {
        ok: true as const,
        changed: false,
        comanda: order.rp_numero_comanda ?? comandaRaw ?? null,
        status: order.status,
      };
    }

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update(updates as never)
      .eq("id", order.id);
    if (updErr) {
      return { ok: false as const, soft: true, reason: `update_failed:${updErr.message}` };
    }

    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "pos_poll",
      ok: true,
      mensaje: `Polling POS aplicó: ${Object.keys(updates).join(", ")} (rp_pedido_id=${order.rp_pedido_id})`,
      payload: {
        order_id: order.id,
        rp_pedido_id: order.rp_pedido_id,
        updates,
        raw_first: first,
      } as never,
    });

    return {
      ok: true as const,
      changed: true,
      comanda: (updates.rp_numero_comanda as string | undefined) ?? order.rp_numero_comanda ?? null,
      status: (updates.status as OrderStatus | undefined) ?? (order.status as OrderStatus),
    };
  });
